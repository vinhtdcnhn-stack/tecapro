import { useState, useEffect, useCallback } from 'react'
import './ContractProgressTab.css'

import { API } from '../../config/api'
import { getStatusInfo, computeForecasts, fmtDate, forecastHint, tmpId } from './progressUtils'
import BBTypeManager from './BBTypeManager'
import DateInput from './DateInput'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import ProgressMobile from './ProgressMobile'

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContractProgressTab({ contractId }) {
  const [rows, setRows]         = useState([])
  const [bbTypes, setBBTypes]   = useState([])
  const [contractDate, setContractDate] = useState(null) // ngày ký HĐ (mốc gốc)
  const [loading, setLoading]   = useState(true)
  const [showBBMgr, setShowBBMgr] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pRes, tRes, cRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/progress`),
        fetch(`${API}/bb-types`),
        fetch(`${API}/contracts/${contractId}`),
      ])
      const [pData, tData, cData] = await Promise.all([pRes.json(), tRes.json(), cRes.json()])
      setRows((Array.isArray(pData) ? pData : []).map(r => toLocal(r)))
      setBBTypes(Array.isArray(tData) ? tData : [])
      setContractDate(cData?.contract_date || null)
    } catch (e) {
      console.error('load progress:', e)
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { load() }, [load])

  function toLocal(r) {
    return { ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false }
  }

  function emptyRow() {
    return {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      bb_type_id: '', offset_days: '', base_bb_type_id: '', base_anchor: '', planned_date: '', actual_date: '', reason: '', penalty_note: '',
      bb_code: '', bb_name: '',
    }
  }

  // ── Cell change ─────────────────────────────────────────────────────────────

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // Chọn mốc gốc: '' = BB trước, 'contract' = ngày ký HĐ, còn lại = id loại biên bản
  const setBase = (key, val) =>
    setRows(prev => prev.map(r => r._key === key ? {
      ...r, _dirty: true,
      base_anchor:     val === 'contract' ? 'contract' : '',
      base_bb_type_id: (val === 'contract' || val === '') ? '' : val,
    } : r))

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      bb_type_id:   row.bb_type_id || null,
      offset_days:  row.offset_days,
      base_bb_type_id: row.base_bb_type_id || null,
      base_anchor:  row.base_anchor || null,
      planned_date: row.planned_date || null,
      actual_date:  row.actual_date  || null,
      reason:       row.reason,
      penalty_note: row.penalty_note,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/progress` : `${API}/progress/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...toLocal(saved), _key: row._key } : r))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    const bbLabel = bbTypes.find(t => String(t.id) === String(row.bb_type_id))?.code || 'dòng này'
    if (!confirm(`Xóa biên bản "${bbLabel}"?`)) return
    try {
      const res = await fetch(`${API}/progress/${row.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const addRow = () => { const r = emptyRow(); setRows(p => [...p, r]); return r._key }

  const isMobile = useIsMobile()

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // ── Derived ───────────────────────────────────────────────────────────────────

  // Ngày dự kiến (động) — tính theo thứ tự hiển thị (đã sort theo sort_order ở backend)
  const forecasts = computeForecasts(rows, contractDate)

  const savedRows  = rows.filter(r => !r._isNew)
  const doneCount  = savedRows.filter(r => r.actual_date).length
  const lateCount  = savedRows.filter(r => {
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

  if (loading) return <div className="prog-loading">Đang tải...</div>

  return (
    <div className="prog-tab">

      {/* ── Toolbar ── */}
      <div className="prog-toolbar">
        <div className="prog-toolbar-left">
          <button className="prog-btn prog-btn-primary" onClick={addRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm biên bản
          </button>
          <button className="prog-btn" onClick={() => setShowBBMgr(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            Quản lý loại BB
          </button>
        </div>
        <div className="prog-stats">
          <span className="stat-chip stat-total">{savedRows.length} biên bản</span>
          <span className="stat-chip stat-done">{doneCount} hoàn thành</span>
          {lateCount > 0 && <span className="stat-chip stat-late">{lateCount} trễ hạn</span>}
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── */}
      {isMobile ? (
        <ProgressMobile
          rows={rows} bbTypes={bbTypes} baseOptions={baseOptions} forecasts={forecasts}
          getStatusInfo={getStatusInfo}
          set={set} setBase={setBase} saveRow={saveRow} deleteRow={deleteRow} addRow={addRow}
        />
      ) : (
      <div className="prog-table-wrapper">
        <table className="prog-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-type">Loại biên bản</th>
              <th className="th-offset">Số ngày (tính từ BB)</th>
              <th className="th-date">Ngày theo HĐ</th>
              <th className="th-date">Ngày dự kiến</th>
              <th className="th-date">Ngày thực tế</th>
              <th className="th-status">Trạng thái</th>
              <th className="th-reason">Nguyên nhân chậm trễ</th>
              <th className="th-penalty">Biên bản phạt</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="10" className="prog-empty">
                  Chưa có biên bản nào. Nhấn <strong>Thêm biên bản</strong> để bắt đầu.
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const forecast = forecasts[row._key]
              const status = getStatusInfo(forecast, row.actual_date)
              const isLate = status.type === 'late' || status.type === 'overdue'
              const hint = !row.actual_date ? forecastHint(forecast) : null
              return (
                <tr key={row._key}
                  className={[
                    `status-${status.type}`,
                    row._dirty   ? 'row-dirty'  : '',
                    row._isNew   ? 'row-new'    : '',
                    row._saving  ? 'row-saving' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
                    <span>{idx + 1}</span>
                  </td>

                  <td className="td-type">
                    <select
                      value={row.bb_type_id || ''}
                      onChange={e => set(row._key, 'bb_type_id', e.target.value)}
                    >
                      <option value="">— Chọn loại —</option>
                      {bbTypes.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.code} – {t.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="td-offset">
                    <div className="offset-cell">
                      <input
                        className="offset-days"
                        type="number" min="0"
                        value={row.offset_days ?? ''}
                        placeholder="20"
                        title="Số ngày kể từ ngày thực tế của biên bản gốc — dùng để tính Ngày dự kiến"
                        onChange={e => set(row._key, 'offset_days', e.target.value)}
                      />
                      <span className="offset-from">từ</span>
                      <select
                        className="offset-base"
                        value={row.base_anchor === 'contract' ? 'contract' : (row.base_bb_type_id || '')}
                        title="Mốc gốc để tính số ngày"
                        onChange={e => setBase(row._key, e.target.value)}
                      >
                        <option value="">BB trước</option>
                        <option value="contract">Ngày ký HĐ</option>
                        {baseOptions
                          .filter(o => String(o.bb_type_id) !== String(row.bb_type_id))
                          .map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                      </select>
                    </div>
                  </td>

                  <td className="td-date">
                    <DateInput
                      value={row.planned_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'planned_date', e.target.value)}
                    />
                  </td>

                  <td className="td-date td-forecast">
                    <span className="forecast-date">{fmtDate(forecast)}</span>
                    {hint && <span className={`forecast-tag forecast-${hint.type}`}>{hint.label}</span>}
                  </td>

                  <td className="td-date">
                    <DateInput
                      value={row.actual_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'actual_date', e.target.value)}
                    />
                  </td>

                  <td className="td-status">
                    <span className={`status-badge badge-${status.type}`}>
                      {status.type === 'ok'      && '✓ '}
                      {status.type === 'late'    && '⚠ '}
                      {status.type === 'overdue' && '⚠ '}
                      {status.type === 'pending' && '⏳ '}
                      {status.label}
                    </span>
                  </td>

                  <td className="td-reason">
                    <input
                      type="text"
                      value={row.reason || ''}
                      onChange={e => set(row._key, 'reason', e.target.value)}
                      placeholder={isLate ? 'Nhập nguyên nhân...' : ''}
                      className={isLate && !row.reason ? 'input-warn' : ''}
                    />
                  </td>

                  <td className="td-penalty">
                    <input
                      type="text"
                      value={row.penalty_note || ''}
                      onChange={e => set(row._key, 'penalty_note', e.target.value)}
                      placeholder="Số/ký hiệu BB phạt..."
                    />
                  </td>

                  <td className="td-action">
                    <div className="action-group">
                      {row._dirty && (
                        <button className="act save" onClick={() => saveRow(row)} disabled={row._saving} title="Lưu">
                          {row._saving
                            ? <span className="spin">⟳</span>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                          }
                        </button>
                      )}
                      <button className="act delete" onClick={() => deleteRow(row)} title="Xóa">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* ── BB Type Manager Modal ── */}
      {showBBMgr && (
        <BBTypeManager
          types={bbTypes}
          onClose={() => setShowBBMgr(false)}
          onUpdated={(updated) => setBBTypes(updated)}
        />
      )}
    </div>
  )
}
