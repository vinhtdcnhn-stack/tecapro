import { useState, useEffect, useCallback, Fragment } from 'react'
import './ContractProgressTab.css'

import { API } from '../../config/api'
import { getStatusInfo, computeForecasts, computePlannedDates, fmtDate, forecastHint, tmpId } from './progressUtils'
import DateInput from './DateInput'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import ProgressMobile from './ProgressMobile'
import EditGuard from './EditGuard'

// Badge trạng thái nhỏ đặt ngay dưới ngày trong ô (giống "Thời hạn thu" ở Công nợ).
function StatusBadgeInline({ st }) {
  if (!st || st.type === 'unknown') return null
  const icon = st.type === 'ok' ? '✓ '
    : (st.type === 'late' || st.type === 'overdue') ? '⚠ '
    : st.type === 'pending' ? '⏳ ' : ''
  return <span className={`dc-status badge-${st.type}`}>{icon}{st.label}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContractProgressTab({ contractId }) {
  const [rows, setRows]         = useState([])
  const [bbTypes, setBBTypes]   = useState([])
  const [contractDate, setContractDate] = useState(null) // ngày ký HĐ (mốc gốc)
  const [loading, setLoading]   = useState(true)

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  function toLocal(r) {
    return { ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false }
  }

  function emptyRow() {
    return {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      bb_type_id: '', offset_days: '', base_bb_type_id: '', base_anchor: '',
      hd_offset_days: '', hd_base_bb_type_id: '', hd_base_anchor: '',
      planned_date: '', actual_date: '', reason: '', penalty_note: '',
      bb_code: '', bb_name: '',
    }
  }

  // ── Cell change ─────────────────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    // Lưu "Ngày theo HĐ" đã giải (động theo mốc gốc hoặc nhập tay) để nơi khác đọc được mốc thực.
    const plannedMap = computePlannedDates(rows, contractDate)
    const body = {
      bb_type_id:   row.bb_type_id || null,
      offset_days:  row.offset_days,
      base_bb_type_id: row.base_bb_type_id || null,
      base_anchor:  row.base_anchor || null,
      hd_offset_days: row.hd_offset_days,
      hd_base_bb_type_id: row.hd_base_bb_type_id || null,
      hd_base_anchor: row.hd_base_anchor || null,
      planned_date: plannedMap[row._key] || null,
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

  // Ngày theo HĐ (động) + Ngày dự kiến (động) — tính theo thứ tự hiển thị (đã sort ở backend)
  const plannedDates = computePlannedDates(rows, contractDate)
  const forecasts    = computeForecasts(rows, contractDate, plannedDates)

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
          <EditGuard>
            <button className="prog-btn prog-btn-primary" onClick={addRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm biên bản
            </button>
          </EditGuard>
        </div>
        <div className="prog-stats">
          <span className="stat-chip stat-total">{savedRows.length} biên bản</span>
          <span className="stat-chip stat-done">{doneCount} hoàn thành</span>
          {lateCount > 0 && <span className="stat-chip stat-late">{lateCount} trễ hạn</span>}
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── Vô hiệu hóa nhập/xóa khi không phải PM */}
      <EditGuard>
      {isMobile ? (
        <ProgressMobile
          rows={rows} bbTypes={bbTypes} baseOptions={baseOptions}
          forecasts={forecasts} plannedDates={plannedDates}
          getStatusInfo={getStatusInfo}
          set={set} setBase={setBase} setHdBase={setHdBase}
          saveRow={saveRow} deleteRow={deleteRow} addRow={addRow}
        />
      ) : (
      <div className="prog-table-wrapper">
        <table className="prog-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-type">Loại biên bản</th>
              <th className="th-datecol">Ngày theo HĐ</th>
              <th className="th-datecol">Ngày dự kiến</th>
              <th className="th-date">Ngày thực tế</th>
              <th className="th-reason">Nguyên nhân chậm trễ</th>
              <th className="th-penalty">Biên bản phạt</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="prog-empty">
                  Chưa có biên bản nào. Nhấn <strong>Thêm biên bản</strong> để bắt đầu.
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const forecast = forecasts[row._key]
              const status = getStatusInfo(forecast, row.actual_date)           // theo Ngày dự kiến
              const hdStatus = getStatusInfo(plannedDates[row._key], row.actual_date) // theo Ngày theo HĐ
              const isLate = status.type === 'late' || status.type === 'overdue'
              const hint = !row.actual_date ? forecastHint(forecast) : null
              // Mốc gốc của 2 cột ngày (động). Ngày theo HĐ: '' = nhập tay; Ngày dự kiến: '' = BB trước.
              const hdBaseVal   = row.hd_base_anchor === 'contract' ? 'contract' : (row.hd_base_bb_type_id || '')
              const hdComputed  = hdBaseVal !== ''
              const fcBaseVal   = row.base_anchor === 'contract' ? 'contract' : (row.base_bb_type_id || '')
              const otherBases  = baseOptions.filter(o => String(o.bb_type_id) !== String(row.bb_type_id))
              return (
                <Fragment key={row._key}>
                <tr
                  className={[
                    'prog-card-row',
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

                  {/* Ngày theo HĐ: mốc gốc + số ngày (theo Ngày theo HĐ của mốc), hoặc nhập tay */}
                  <td className="td-datecol">
                    <div className="prog-datecell">
                      <div className="dc-row">
                        <select className="dc-base" value={hdBaseVal}
                          title="Mốc tính Ngày theo HĐ: nhập ngày trực tiếp, hoặc số ngày kể từ ngày ký HĐ / biên bản khác"
                          onChange={e => setHdBase(row._key, e.target.value)}>
                          <option value="">Nhập ngày</option>
                          <option value="contract">Ngày ký HĐ</option>
                          {otherBases.map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                        </select>
                        {hdComputed && (
                          <>
                            <input className="dc-days" type="number" min="0"
                              value={row.hd_offset_days ?? ''} placeholder="0"
                              title="Số ngày kể từ mốc gốc"
                              onChange={e => set(row._key, 'hd_offset_days', e.target.value)} />
                            <span className="dc-from">ngày</span>
                          </>
                        )}
                      </div>
                      {hdComputed
                        ? <span className="dc-resolved">→ {fmtDate(plannedDates[row._key])}</span>
                        : <DateInput value={row.planned_date?.slice(0, 10) || ''}
                            onChange={e => set(row._key, 'planned_date', e.target.value)} />}
                      <StatusBadgeInline st={hdStatus} />
                    </div>
                  </td>

                  {/* Ngày dự kiến: mốc gốc + số ngày (theo ngày thực tế đã ký) → tự tính */}
                  <td className="td-datecol td-forecast">
                    <div className="prog-datecell">
                      <div className="dc-row">
                        <select className="dc-base" value={fcBaseVal}
                          title="Mốc gốc tính Ngày dự kiến (theo ngày thực tế đã ký của mốc)"
                          onChange={e => setBase(row._key, e.target.value)}>
                          <option value="">BB trước</option>
                          <option value="contract">Ngày ký HĐ</option>
                          {otherBases.map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
                        </select>
                        <input className="dc-days" type="number" min="0"
                          value={row.offset_days ?? ''} placeholder="0"
                          title="Số ngày kể từ ngày thực tế của mốc gốc"
                          onChange={e => set(row._key, 'offset_days', e.target.value)} />
                        <span className="dc-from">ngày</span>
                      </div>
                      <span className="dc-resolved">→ {fmtDate(forecast)}</span>
                      <StatusBadgeInline st={status} />
                      {hint && <span className={`forecast-tag forecast-${hint.type}`}>{hint.label}</span>}
                    </div>
                  </td>

                  <td className="td-date">
                    <DateInput
                      value={row.actual_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'actual_date', e.target.value)}
                    />
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
                <tr className="prog-row-gap" aria-hidden="true"><td colSpan="8" /></tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      </EditGuard>
    </div>
  )
}
