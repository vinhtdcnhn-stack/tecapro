import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { stripNum, calcAmounts, tmpId } from './boqUtils'
import useCtrlSave from './useCtrlSave'
import usePurchaseBOQLink from './usePurchaseBOQLink'
import useBienBanOptions, { useBienBanMap } from './useBienBanOptions'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { withStamp, handledConflict } from './conflict'

// Toàn bộ state & logic của tab Bảng giá mua (HĐ nhập): load, CRUD, kéo-thả, lọc,
// chọn nhiều dòng, import Excel, mốc bảo hành. Tách khỏi ContractInBOQTab.jsx để
// component chỉ còn phần render (giữ mỗi file dưới 500 dòng), giống useBOQTab bên HĐ bán.

const toLocalRow = (r) => ({
  ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
  links: Array.isArray(r.links) ? r.links : [],
  quantity: stripNum(r.quantity), unit_price: stripNum(r.unit_price), vat_rate: stripNum(r.vat_rate),
})

const emptyRow = (insertAfterRefId = null) => ({
  id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
  _insertAfterRefId: insertAfterRefId,
  item_name: '', unit: '', quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
  // Mốc bảo hành để trống ⇒ dòng mới kế thừa mặc định của cả bảng giá.
  warranty_bb_id: null, warranty_months: null,
})

export default function usePurchaseBOQTab(contractInId, currency, viewContractId, warrantyDefaultInit) {
  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [importData, setImportData]   = useState(null)
  const [importMode, setImportMode]   = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [dragKey, setDragKey]         = useState(null)   // _key của dòng đang kéo
  const [dragOverKey, setDragOverKey] = useState(null)
  const excelRef = useRef(null)

  const { targets, reloadTargets, saveLinks } = usePurchaseBOQLink(contractInId, viewContractId)

  // ── Mốc bảo hành ────────────────────────────────────────────────────────────
  // Biên bản của CHÍNH HĐ nhập (tab Tiến độ biên bản của HĐ nhập): bảo hành nhà cung
  // cấp tính từ ngày nghiệm thu/bàn giao với NCC.
  const bbList = useBienBanOptions(contractInId, 'in')
  const bbById = useBienBanMap(bbList)
  const [warrantyDefault, setWarrantyDefault] = useState({
    bbId: warrantyDefaultInit?.bbId ?? null,
    months: warrantyDefaultInit?.months ?? null,
  })

  const saveWarrantyDefault = async ({ bbId, months }) => {
    const res = await fetch(`${API}/contract-ins/${contractInId}/boq-warranty-default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warranty_bb_id: bbId, warranty_months: months }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Không lưu được mốc bảo hành mặc định.')
    setWarrantyDefault({ bbId: data.boq_warranty_bb_id ?? null, months: data.boq_warranty_months ?? null })
  }

  // Thay toàn bộ ghép "Nhập cho" của 1 dòng (nhiều đầu bán); cập nhật links trong state + làm mới target.
  const setLinks = async (row, links) => {
    try {
      const saved = await saveLinks(row.id, links)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, links: saved } : r))
      reloadTargets()
    } catch (e) { alert('Lỗi lưu "Nhập cho": ' + e.message) }
  }

  const load = useCallback(async () => {
    try {
      const data = await apiGet(`/contract-ins/${contractInId}/boq`, { conditional: true })
      setRows((Array.isArray(data) ? data : []).map(r => toLocalRow(r)))
      setSelected(new Set())
    } catch (e) { console.error('load purchase BOQ:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // Không cho phép 2 dòng trùng tên hàng (đã cắt khoảng trắng, không phân biệt hoa/thường).
  const duplicateNameKey = (row) => {
    const name = (row.item_name || '').trim().toLowerCase()
    if (!name) return null
    const dup = rows.find(r => r._key !== row._key && (r.item_name || '').trim().toLowerCase() === name)
    return dup ? dup._key : null
  }

  const saveRow = async (row) => {
    if (duplicateNameKey(row)) {
      alert(`Trùng tên hàng hóa: "${row.item_name.trim()}" đã có ở dòng khác trong bảng giá mua.`)
      return
    }
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)
    const body = {
      item_name: row.item_name, unit: row.unit,
      quantity: row.quantity, unit_price: row.unit_price,
      amount_before_vat: before, vat_rate: row.vat_rate,
      amount_after_vat: after, warranty_period: row.warranty_period,
      warranty_bb_id: row.warranty_bb_id ?? null,
      warranty_months: row.warranty_months ?? null,
    }
    try {
      let url, method
      if (row._isNew) {
        method = 'POST'
        url = row._insertAfterRefId
          ? `${API}/contract-ins/${contractInId}/boq/after/${row._insertAfterRefId}`
          : `${API}/contract-ins/${contractInId}/boq`
      } else {
        method = 'PUT'
        url = `${API}/purchase-boq/${row.id}`
      }
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStamp(body, row)) })
      const saved = await res.json()
      if (await handledConflict(res, saved, load)) return
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      // Giữ lại ghép "Nhập cho" (links) vì response lưu dòng không kèm trường này.
      setRows(prev => prev.map(r => r._key === row._key ? {
        ...toLocalRow(saved), _key: row._key, links: r.links || [],
      } : r))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa dòng "${row.item_name || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/purchase-boq/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
      setSelected(prev => { const n = new Set(prev); n.delete(row._key); return n })
    } catch { alert('Không thể xóa dòng này.') }
  }

  const insertAfter = (row) => {
    const newRow = emptyRow(row._isNew ? null : row.id)
    setRows(prev => {
      const copy = [...prev]
      copy.splice(prev.findIndex(r => r._key === row._key) + 1, 0, newRow)
      return copy
    })
  }

  const addRow = () => {
    const r = emptyRow(null)
    setRows(prev => [...prev, r])
    return r._key
  }

  // ── Kéo-thả đổi thứ tự ─────────────────────────────────────────────────────
  // Chỉ cho phép kéo dòng đã lưu (có id).

  const persistOrder = async (orderedRows) => {
    const ids = orderedRows.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!ids.length) return
    try {
      await fetch(`${API}/contract-ins/${contractInId}/boq/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch (e) {
      console.error('reorder purchase BOQ:', e)
      load()  // khôi phục thứ tự từ server nếu lỗi
    }
  }

  const handleDragStart = (e, key) => {
    // Không bắt đầu kéo khi thao tác trong ô nhập liệu
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
      e.preventDefault()
      return
    }
    setDragKey(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)  // Firefox cần dữ liệu để khởi động kéo
  }

  const handleDragOver = (e) => {
    if (!dragKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (key) => {
    if (dragKey && key !== dragKey) setDragOverKey(key)
  }

  const handleDragEnd = () => { setDragKey(null); setDragOverKey(null) }

  const handleDrop = (e, targetKey) => {
    e.preventDefault()
    if (!dragKey || dragKey === targetKey) { handleDragEnd(); return }

    // Thả ở nửa dưới của dòng đích → chèn sau, nửa trên → chèn trước
    const rect = e.currentTarget.getBoundingClientRect()
    const after = (e.clientY - rect.top) > rect.height / 2

    let reordered = null
    setRows(prev => {
      const copy = [...prev]
      const from = copy.findIndex(r => r._key === dragKey)
      if (from < 0) return prev
      const [moved] = copy.splice(from, 1)
      const to = copy.findIndex(r => r._key === targetKey)
      if (to < 0) return prev
      copy.splice(after ? to + 1 : to, 0, moved)
      reordered = copy
      return copy
    })
    if (reordered) persistOrder(reordered)
    handleDragEnd()
  }

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // ── Lọc theo tên hàng ─────────────────────────────────────────────────────
  // Dòng mới (_isNew) luôn hiển thị để không bị ẩn khi đang lọc. Giữ số thứ tự gốc qua idx.
  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => {
        if (r._isNew) return true
        if (!kw) return true
        return (r.item_name || '').toLowerCase().includes(kw)
      })
  }, [rows, search])

  const isFiltering = search.trim() !== ''

  // ── Chọn nhiều dòng để xóa loạt ────────────────────────────────────────────
  const toggleSelect = (key) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const selectableKeys = visibleRows.filter(({ r }) => !r._isNew).map(({ r }) => r._key)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selected.has(k))

  const toggleSelectAll = () =>
    setSelected(prev => {
      if (allSelected) { const n = new Set(prev); selectableKeys.forEach(k => n.delete(k)); return n }
      return new Set([...prev, ...selectableKeys])
    })

  const selectedCount = selected.size

  const bulkDelete = async () => {
    const keys = [...selected]
    const targetRows = rows.filter(r => keys.includes(r._key))
    const ids = targetRows.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!confirm(`Xóa ${targetRows.length} dòng đã chọn?`)) return

    setBulkDeleting(true)
    try {
      if (ids.length) {
        const res = await fetch(`${API}/purchase-boq/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (!res.ok) throw new Error('Bulk delete failed')
      }
      setRows(prev => prev.filter(r => !keys.includes(r._key)))
      setSelected(new Set())
    } catch {
      alert('Không thể xóa các dòng đã chọn.')
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Excel import ──────────────────────────────────────────────────────────
  const handleExcelFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    excelRef.current.value = ''
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/boq/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi đọc file'); return }
      setImportData(data)
      setImportMode('append')
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  const confirmImport = async () => {
    if (!importData) return
    setImportSaving(true)
    try {
      const res = await fetch(`${API}/contract-ins/${contractInId}/boq/save-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importData.items, replaceAll: importMode === 'replace' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      setImportData(null)
      setLoading(true)
      await load()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setImportSaving(false) }
  }

  const totals = useMemo(() => rows.reduce((acc, r) => {
    const { before, after } = calcAmounts(r.quantity, r.unit_price, r.vat_rate, currency)
    return { before: acc.before + before, after: acc.after + after }
  }, { before: 0, after: 0 }), [rows, currency])

  return {
    // data
    rows, loading, totals, visibleRows, isFiltering,
    // ghép "Nhập cho"
    targets, setLinks,
    // mốc bảo hành (biên bản HĐ nhập + số tháng)
    bbList, bbById, warrantyDefault, saveWarrantyDefault,
    // filter
    search, setSearch,
    // selection
    selected, toggleSelect, allSelected, toggleSelectAll, selectableKeys, selectedCount,
    bulkDelete, bulkDeleting,
    // row ops
    set, saveRow, deleteRow, insertAfter, addRow,
    // drag-reorder
    dragKey, dragOverKey, handleDragStart, handleDragOver, handleDragEnter, handleDrop, handleDragEnd,
    // excel import
    excelRef, handleExcelFile, importData, importMode, setImportMode, importSaving, confirmImport, setImportData,
  }
}
