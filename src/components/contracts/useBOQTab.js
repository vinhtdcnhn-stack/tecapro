import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { stripNum, calcAmounts, tmpId } from './boqUtils'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import { API } from '../../config/api'

// ── Helpers thuần (không phụ thuộc state) ─────────────────────────────────────

function toLocalRow(r) {
  return {
    ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
    quantity: stripNum(r.quantity), unit_price: stripNum(r.unit_price), vat_rate: stripNum(r.vat_rate),
  }
}

function emptyRow(insertAfterRefId = null) {
  return {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    _insertAfterRefId: insertAfterRefId,
    item_name: '', hs_code: '', unit: '',
    quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
    item_type: 'trong_nuoc',
  }
}

// ── Hook: toàn bộ state & logic của tab BOQ (load, CRUD, kéo-thả, lọc, chọn, import) ──

export default function useBOQTab(contractId) {
  const [rows, setRows]           = useState([])
  const [currency, setCurrency]   = useState('VND')
  const [loading, setLoading]     = useState(true)
  const [importData, setImportData] = useState(null)  // { items, total }
  const [importMode, setImportMode] = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'trong_nuoc' | 'di_thang'
  const [selected, setSelected]   = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [dragKey, setDragKey]     = useState(null)   // _key của dòng đang kéo
  const [dragOverKey, setDragOverKey] = useState(null)
  const excelRef = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [res, cRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/boq`),
        fetch(`${API}/contracts/${contractId}`),
      ])
      const data  = await res.json()
      const cData = await cRes.json()
      setCurrency(cData?.currency_code || 'VND')
      setRows(data.map(r => toLocalRow(r)))
      setSelected(new Set())
    } catch (e) {
      console.error('load BOQ:', e)
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { load() }, [load])

  // ── Cell change ───────────────────────────────────────────────────────────────

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // ── Save row ─────────────────────────────────────────────────────────────────

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))

    const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)
    const body = {
      item_name:        row.item_name,
      hs_code:          row.hs_code,
      unit:             row.unit,
      quantity:         row.quantity,
      unit_price:       row.unit_price,
      amount_before_vat: before,
      vat_rate:         row.vat_rate,
      amount_after_vat: after,
      warranty_period:  row.warranty_period,
      item_type:        row.item_type || 'trong_nuoc',
    }

    try {
      let url, method
      if (row._isNew) {
        method = 'POST'
        url = row._insertAfterRefId
          ? `${API}/contracts/${contractId}/boq/after/${row._insertAfterRefId}`
          : `${API}/contracts/${contractId}/boq`
      } else {
        method = 'PUT'
        url = `${API}/boq/${row.id}`
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const saved = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')

      setRows(prev => prev.map(r =>
        r._key === row._key
          ? { ...toLocalRow(saved), _key: row._key }
          : r
      ))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  // ── Delete row ────────────────────────────────────────────────────────────────

  const deleteRow = async (row) => {
    if (row._isNew) {
      setRows(prev => prev.filter(r => r._key !== row._key))
      return
    }
    if (!confirm(`Xóa dòng "${row.item_name || '(trống)'}"?`)) return
    try {
      const res = await fetch(`${API}/boq/${row.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows(prev => prev.filter(r => r._key !== row._key))
      setSelected(prev => { const n = new Set(prev); n.delete(row._key); return n })
    } catch {
      alert('Không thể xóa dòng này.')
    }
  }

  // ── Insert after ──────────────────────────────────────────────────────────────

  const insertAfter = (row) => {
    const newRow = emptyRow(row._isNew ? null : row.id)
    setRows(prev => {
      const copy = [...prev]
      copy.splice(prev.findIndex(r => r._key === row._key) + 1, 0, newRow)
      return copy
    })
  }

  // ── Add row at end ────────────────────────────────────────────────────────────

  const addRow = () => {
    const r = emptyRow(null)
    setRows(prev => [...prev, r])
    return r._key
  }

  // ── Kéo-thả đổi thứ tự ─────────────────────────────────────────────────────
  // Chỉ cho phép kéo dòng đã lưu khi không lọc (thứ tự hiển thị == thứ tự gốc).

  const persistOrder = async (orderedRows) => {
    const ids = orderedRows.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!ids.length) return
    try {
      await fetch(`${API}/contracts/${contractId}/boq/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch (e) {
      console.error('reorder BOQ:', e)
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

  const isMobile = useIsMobile()

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // ── Filter ──────────────────────────────────────────────────────────────────

  // Lọc theo từ khóa (tên hàng / HScode) và loại hàng. Dòng mới (_isNew) luôn hiển
  // thị để không bị ẩn khi đang lọc. Giữ số thứ tự gốc qua _idx.
  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => {
        if (r._isNew) return true
        if (typeFilter !== 'all' && (r.item_type || 'trong_nuoc') !== typeFilter) return false
        if (!kw) return true
        return `${r.item_name || ''} ${r.hs_code || ''}`.toLowerCase().includes(kw)
      })
  }, [rows, search, typeFilter])

  const isFiltering = search.trim() !== '' || typeFilter !== 'all'

  // ── Selection ─────────────────────────────────────────────────────────────────

  const toggleSelect = (key) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Các dòng đang nhìn thấy (đã lưu, có id) có thể chọn
  const selectableKeys = visibleRows.filter(({ r }) => !r._isNew).map(({ r }) => r._key)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selected.has(k))

  const toggleSelectAll = () =>
    setSelected(prev => {
      if (allSelected) {
        const n = new Set(prev); selectableKeys.forEach(k => n.delete(k)); return n
      }
      return new Set([...prev, ...selectableKeys])
    })

  const selectedCount = selected.size

  const bulkDelete = async () => {
    const keys = [...selected]
    const targets = rows.filter(r => keys.includes(r._key))
    const ids = targets.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!confirm(`Xóa ${targets.length} dòng đã chọn?`)) return

    setBulkDeleting(true)
    try {
      if (ids.length) {
        const res = await fetch(`${API}/boq/bulk-delete`, {
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

  // ── Excel import ──────────────────────────────────────────────────────────────

  const handleExcelFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    excelRef.current.value = ''

    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`${API}/contracts/${contractId}/boq/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi đọc file'); return }
      setImportData(data)
      setImportMode('append')
    } catch (e) {
      alert('Lỗi: ' + e.message)
    }
  }

  const confirmImport = async () => {
    if (!importData) return
    setImportSaving(true)
    try {
      const res = await fetch(`${API}/contracts/${contractId}/boq/save-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importData.items, replaceAll: importMode === 'replace' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      setImportData(null)
      setLoading(true)
      await load()
    } catch (e) {
      alert('Lỗi: ' + e.message)
    } finally {
      setImportSaving(false)
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────────

  const totals = rows.reduce((acc, r) => {
    const { before, after } = calcAmounts(r.quantity, r.unit_price, r.vat_rate, currency)
    return { before: acc.before + before, after: acc.after + after }
  }, { before: 0, after: 0 })

  return {
    // data
    rows, currency, loading, totals, isMobile,
    // filter
    search, setSearch, typeFilter, setTypeFilter, isFiltering, visibleRows,
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
