import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { computeForecasts, computePlannedDates, getStatusInfo, tmpId } from './progressUtils'
import { withStamp, handledConflict } from './conflict'
import useCtrlSave from './useCtrlSave'

// Trạng thái + thao tác của tab "Tiến độ theo biên bản" — dùng chung HĐ BÁN và HĐ NHẬP.
// Hai đầu chỉ khác đường dẫn API; công thức tính ngày (mốc gốc + số ngày) giống hệt nhau.
//   listPath   — GET danh sách biên bản của hợp đồng
//   createPath — POST thêm biên bản
//   itemPath   — (id) => đường dẫn PUT/DELETE một biên bản
//   infoPath   — (tùy chọn) GET thông tin hợp đồng để lấy contract_date làm mốc "Ngày ký HĐ"
//   signDate   — (tùy chọn) ngày ký truyền thẳng từ cha; có thì không cần infoPath
export default function useProgressRows({ listPath, createPath, itemPath, infoPath = null, signDate = null }) {
  const [rows, setRows]                 = useState([])
  const [bbTypes, setBBTypes]           = useState([])
  const [fetchedDate, setFetchedDate]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const contractDate = signDate || fetchedDate

  const toLocal = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })

  const load = useCallback(async () => {
    try {
      const [pData, tData, cData] = await Promise.all([
        apiGet(listPath, { conditional: true }),
        apiGet('/bb-types', { conditional: true }),
        infoPath ? apiGet(infoPath, { conditional: true }).catch(() => null) : null,
      ])
      setRows((Array.isArray(pData) ? pData : []).map(toLocal))
      setBBTypes(Array.isArray(tData) ? tData : [])
      if (cData?.contract_date) setFetchedDate(cData.contract_date)
    } catch (e) { console.error('load progress:', e) }
    finally { setLoading(false) }
  }, [listPath, infoPath])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  const emptyRow = () => ({
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    bb_type_id: '', offset_days: '', base_bb_type_id: '', base_anchor: '',
    hd_offset_days: '', hd_base_bb_type_id: '', hd_base_anchor: '',
    planned_date: '', actual_date: '', reason: '', penalty_note: '',
    bb_code: '', bb_name: '',
  })

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // Mốc gốc "Ngày dự kiến": '' = BB trước, 'contract' = ngày ký HĐ, còn lại = id loại biên bản
  const setBase = (key, val) =>
    setRows(prev => prev.map(r => r._key === key ? {
      ...r, _dirty: true,
      base_anchor:     val === 'contract' ? 'contract' : '',
      base_bb_type_id: (val === 'contract' || val === '') ? '' : val,
    } : r))

  // Mốc gốc "Ngày theo HĐ": '' = Nhập ngày (tay), 'contract' = ngày ký HĐ, còn lại = id loại biên bản
  const setHdBase = (key, val) =>
    setRows(prev => prev.map(r => r._key === key ? {
      ...r, _dirty: true,
      hd_base_anchor:     val === 'contract' ? 'contract' : '',
      hd_base_bb_type_id: (val === 'contract' || val === '') ? '' : val,
    } : r))

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    // Lưu "Ngày theo HĐ" đã giải (động theo mốc gốc hoặc nhập tay) để nơi khác đọc được mốc thực.
    const plannedMap = computePlannedDates(rows, contractDate)
    const body = {
      bb_type_id:         row.bb_type_id || null,
      offset_days:        row.offset_days,
      base_bb_type_id:    row.base_bb_type_id || null,
      base_anchor:        row.base_anchor || null,
      hd_offset_days:     row.hd_offset_days,
      hd_base_bb_type_id: row.hd_base_bb_type_id || null,
      hd_base_anchor:     row.hd_base_anchor || null,
      planned_date:       plannedMap[row._key] || null,
      actual_date:        row.actual_date || null,
      reason:             row.reason,
      penalty_note:       row.penalty_note,
    }
    try {
      const url    = row._isNew ? `${API}${createPath}` : `${API}${itemPath(row.id)}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStamp(body, row)) })
      const saved  = await res.json()
      if (await handledConflict(res, saved, load)) return
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...toLocal(saved), _key: row._key } : r))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    const bbLabel = bbTypes.find(t => String(t.id) === String(row.bb_type_id))?.code || 'dòng này'
    if (!confirm(`Xóa biên bản "${bbLabel}"?`)) return
    try {
      const res = await fetch(`${API}${itemPath(row.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const addRow = () => { const r = emptyRow(); setRows(p => [...p, r]); return r._key }

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // Ngày theo HĐ (động) + Ngày dự kiến (động) — tính theo thứ tự hiển thị (đã sort ở backend)
  const plannedDates = computePlannedDates(rows, contractDate)
  const forecasts    = computeForecasts(rows, contractDate, plannedDates)

  const savedRows = rows.filter(r => !r._isNew)
  const doneCount = savedRows.filter(r => r.actual_date).length
  const lateCount = savedRows.filter(r => {
    const { type } = getStatusInfo(forecasts[r._key], r.actual_date)
    return type === 'late' || type === 'overdue'
  }).length

  // Danh sách "mốc gốc" cho dropdown: các loại biên bản đang có trong hợp đồng (không trùng)
  const baseOptions = []
  const seenType = new Set()
  rows.forEach(r => {
    if (!r.bb_type_id || seenType.has(String(r.bb_type_id))) return
    seenType.add(String(r.bb_type_id))
    const t = bbTypes.find(x => String(x.id) === String(r.bb_type_id))
    baseOptions.push({ bb_type_id: r.bb_type_id, code: t ? t.code : '—' })
  })

  return {
    rows, bbTypes, loading, baseOptions, plannedDates, forecasts,
    savedRows, doneCount, lateCount,
    set, setBase, setHdBase, saveRow, deleteRow, addRow,
  }
}
