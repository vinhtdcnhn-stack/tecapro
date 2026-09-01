import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { stripNum, calcAmounts, tmpId } from './boqUtils'
import { buildTreeOrder, computeRollup, treeTotals, ROW_KIND } from './boqTree'
import useBOQDrag from './useBOQDrag'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { withStamp, handledConflict } from './conflict'
import useBienBanOptions, { useBienBanMap } from './useBienBanOptions'

// ── Helpers thuần (không phụ thuộc state) ─────────────────────────────────────

// Chuẩn hóa tên để so trùng: bỏ hoa-thường + gộp khoảng trắng (khớp logic backend).
const normName = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

// Khóa cha so sánh anh-em (cùng parent_id). null = cấp gốc.
const parentKey = (r) => (r.parent_id != null ? String(r.parent_id) : null)

function toLocalRow(r) {
  return {
    ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
    row_kind: r.row_kind || ROW_KIND.LEAF,
    parent_id: r.parent_id != null ? r.parent_id : null,
    multiply_qty: !!r.multiply_qty,
    hide_amount: !!r.hide_amount,
    quantity: stripNum(r.quantity), unit_price: stripNum(r.unit_price), vat_rate: stripNum(r.vat_rate),
  }
}

function emptyRow({ insertAfterRefId = null, parentId = null, rowKind = ROW_KIND.LEAF } = {}) {
  return {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    _insertAfterRefId: insertAfterRefId,
    parent_id: parentId, row_kind: rowKind,
    item_name: '', hs_code: '', unit: '',
    quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
    // Mốc bảo hành để trống ⇒ dòng mới kế thừa mặc định của cả bảng giá.
    warranty_bb_id: null, warranty_months: null,
    item_type: 'trong_nuoc',
  }
}

// ── Hook: toàn bộ state & logic của tab BOQ (load, CRUD, kéo-thả, lọc, chọn, import) ──

export default function useBOQTab(contractId) {
  const [rows, setRows]           = useState([])
  const [currency, setCurrency]   = useState('VND')
  const [lock, setLock]           = useState({ locked: false, byName: null, at: null })
  // Mốc bảo hành mặc định của cả bảng giá (contract_out.boq_warranty_*)
  const [warrantyDefault, setWarrantyDefault] = useState({ bbId: null, months: null })
  const [loading, setLoading]     = useState(true)
  const [importData, setImportData] = useState(null)  // { items, total }
  const [importMode, setImportMode] = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'trong_nuoc' | 'di_thang'
  const [selected, setSelected]   = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const excelRef = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [data, cData] = await Promise.all([
        apiGet(`/contracts/${contractId}/boq`, { conditional: true }),
        apiGet(`/contracts/${contractId}`, { conditional: true }),
      ])
      setCurrency(cData?.currency_code || 'VND')
      setLock({ locked: !!cData?.boq_locked, byName: cData?.boq_locked_by_name || null, at: cData?.boq_locked_at || null })
      setWarrantyDefault({
        bbId: cData?.boq_warranty_bb_id ?? null,
        months: cData?.boq_warranty_months ?? null,
      })
      setRows(data.map(r => toLocalRow(r)))
      setSelected(new Set())
    } catch (e) {
      console.error('load BOQ:', e)
    } finally {
      setLoading(false)
    }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // ── Cell change ───────────────────────────────────────────────────────────────

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // Vá trực tiếp 1 vài trường của dòng KHÔNG đánh dấu _dirty (dùng cho cờ no_import_needed
  // lưu qua endpoint riêng, không đi qua saveRow).
  const patchRow = (key, patch) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r))

  // ── Validate tên (trống / trùng anh-em cùng cành) ─────────────────────────────

  // Trả chuỗi lỗi nếu tên trống hoặc trùng dòng khác cùng parent_id; null nếu hợp lệ.
  const siblingNameError = (row) => {
    const norm = normName(row.item_name)
    if (!norm) return 'Tên không được để trống.'
    const pk = parentKey(row)
    const dup = rows.some(r =>
      r._key !== row._key && parentKey(r) === pk && normName(r.item_name) === norm
    )
    return dup ? `Tên "${String(row.item_name).trim()}" đã trùng với một dòng khác trong cùng cành (cùng cấp).` : null
  }

  // ── Save row ─────────────────────────────────────────────────────────────────

  const saveRow = async (row) => {
    const nameErr = siblingNameError(row)
    if (nameErr) { alert(nameErr); return }

    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))

    const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)
    const body = {
      parent_id:        row.parent_id ?? null,
      row_kind:         row.row_kind || 'leaf',
      item_name:        row.item_name,
      hs_code:          row.hs_code,
      unit:             row.unit,
      quantity:         row.quantity,
      unit_price:       row.unit_price,
      amount_before_vat: before,
      vat_rate:         row.vat_rate,
      amount_after_vat: after,
      warranty_period:  row.warranty_period,
      warranty_bb_id:   row.warranty_bb_id ?? null,
      warranty_months:  row.warranty_months ?? null,
      item_type:        row.item_type || 'trong_nuoc',
      multiply_qty:     !!row.multiply_qty,
      hide_amount:      !!row.hide_amount,
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
        body: JSON.stringify(withStamp(body, row)),
      })
      const saved = await res.json()
      if (await handledConflict(res, saved, load)) return
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Delete failed')
      }
      setRows(prev => prev.filter(r => r._key !== row._key))
      setSelected(prev => { const n = new Set(prev); n.delete(row._key); return n })
    } catch (e) {
      alert(e.message || 'Không thể xóa dòng này.')
    }
  }

  // ── Insert after ──────────────────────────────────────────────────────────────

  const insertAfter = (row) => {
    // Dòng mới là anh-em cùng cấp với dòng tham chiếu (kế thừa parent_id, row_kind).
    const newRow = emptyRow({
      insertAfterRefId: row._isNew ? null : row.id,
      parentId: row.parent_id ?? null,
      rowKind: row.row_kind || ROW_KIND.LEAF,
    })
    setRows(prev => {
      const copy = [...prev]
      copy.splice(prev.findIndex(r => r._key === row._key) + 1, 0, newRow)
      return copy
    })
  }

  // ── Add row / zone at end ──────────────────────────────────────────────────────

  const addRow = () => {
    const r = emptyRow({})
    setRows(prev => [...prev, r])
    return r._key
  }

  const addZone = () => {
    const r = emptyRow({ rowKind: ROW_KIND.ZONE })
    setRows(prev => [...prev, r])
    return r._key
  }

  // Thêm nhóm (Hệ thống) ở cấp gốc — không cần tạo "phần" trước.
  const addGroup = () => {
    const r = emptyRow({ rowKind: ROW_KIND.GROUP })
    setRows(prev => [...prev, r])
    return r._key
  }

  // Thêm con (nhóm hoặc dòng) cho 1 node đã lưu. Node cha phải có id thật.
  const addChild = (parentRow, kind = ROW_KIND.LEAF) => {
    if (!parentRow.id) { alert('Hãy lưu dòng cha trước khi thêm dòng con.'); return null }
    const r = emptyRow({ parentId: parentRow.id, rowKind: kind })
    setRows(prev => {
      const copy = [...prev]
      // chèn ngay sau cha để hiển thị liền mạch (cây vẫn dựng theo parent_id)
      copy.splice(prev.findIndex(x => x._key === parentRow._key) + 1, 0, r)
      return copy
    })
    return r._key
  }

  // Bật/tắt "nhân thành tiền theo SL hệ thống" cho dòng nhóm. Lưu ngay nếu đã có id.
  const toggleMultiply = (row) => {
    const updated = { ...row, multiply_qty: !row.multiply_qty, _dirty: true }
    setRows(prev => prev.map(r => r._key === row._key ? updated : r))
    if (updated.id) saveRow(updated)
  }

  // Ẩn/hiện số tiền của dòng hệ thống (chỉ hiển thị — tổng hợp đồng KHÔNG đổi).
  // Lưu ngay như toggleMultiply để trạng thái ẩn dùng chung cho mọi người.
  const toggleHideAmount = (row) => {
    const updated = { ...row, hide_amount: !row.hide_amount, _dirty: true }
    setRows(prev => prev.map(r => r._key === row._key ? updated : r))
    if (updated.id) saveRow(updated)
  }

  // Kéo-thả sắp xếp lại cây bảng giá (state + handler ở useBOQDrag)
  const drag = useBOQDrag({ contractId, rows, setRows, load })

  const isMobile = useIsMobile()

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // ── Filter ──────────────────────────────────────────────────────────────────

  const isFiltering = search.trim() !== '' || typeFilter !== 'all'

  // Roll-up số tiền cho node nhóm/zone (hiển thị tức thời, không chờ server).
  const rollup = useMemo(() => computeRollup(rows, currency), [rows, currency])

  // Khi KHÔNG lọc: hiển thị theo cây (kèm depth để thụt lề). Khi lọc: danh sách phẳng
  // các dòng khớp (mất phân cấp, depth 0). Dòng mới (_isNew) luôn hiển thị.
  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (isFiltering) {
      return rows
        .map((r, idx) => ({ r, idx, depth: 0 }))
        .filter(({ r }) => {
          if (r._isNew) return true
          if (typeFilter !== 'all' && (r.item_type || 'trong_nuoc') !== typeFilter) return false
          if (!kw) return true
          return `${r.item_name || ''} ${r.hs_code || ''}`.toLowerCase().includes(kw)
        })
    }
    return buildTreeOrder(rows).map((n, idx) => ({ r: n.r, idx, depth: n.depth, no: n.no }))
  }, [rows, search, typeFilter, isFiltering])

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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Bulk delete failed')
        }
      }
      setRows(prev => prev.filter(r => !keys.includes(r._key)))
      setSelected(new Set())
    } catch (e) {
      alert(e.message || 'Không thể xóa các dòng đã chọn.')
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

  // Tổng HĐ = tổng số tiền các node gốc (đã roll-up + hệ số ×SL của nhóm).
  const totals = useMemo(() => treeTotals(rows, rollup), [rows, rollup])

  // Cập nhật trạng thái khóa tại chỗ sau khi khóa/mở khóa (không cần load lại cả bảng).
  const applyLock = (row) => setLock({
    locked: !!row?.boq_locked, byName: row?.boq_locked_by_name || null, at: row?.boq_locked_at || null,
  })

  // ── Mốc bảo hành ────────────────────────────────────────────────────────────
  // Biên bản của chính HĐ bán (tab Tiến độ biên bản) → nguồn ngày bắt đầu bảo hành.
  const bbList = useBienBanOptions(contractId, 'out')
  const bbById = useBienBanMap(bbList)

  const saveWarrantyDefault = async ({ bbId, months }) => {
    const res = await fetch(`${API}/contracts/${contractId}/boq-warranty-default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warranty_bb_id: bbId, warranty_months: months }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Không lưu được mốc bảo hành mặc định.')
    setWarrantyDefault({ bbId: data.boq_warranty_bb_id ?? null, months: data.boq_warranty_months ?? null })
  }

  return {
    // data
    rows, currency, loading, totals, isMobile, rollup,
    // khóa bảng giá
    lock, applyLock,
    // mốc bảo hành (biên bản + số tháng)
    bbList, bbById, warrantyDefault, saveWarrantyDefault,
    // filter
    search, setSearch, typeFilter, setTypeFilter, isFiltering, visibleRows,
    // selection
    selected, toggleSelect, allSelected, toggleSelectAll, selectableKeys, selectedCount,
    bulkDelete, bulkDeleting,
    // row ops
    set, patchRow, saveRow, deleteRow, insertAfter, addRow, addZone, addGroup, addChild, toggleMultiply, toggleHideAmount,
    // drag-reorder
    ...drag,
    // excel import
    excelRef, handleExcelFile, importData, importMode, setImportMode, importSaving, confirmImport, setImportData,
  }
}
