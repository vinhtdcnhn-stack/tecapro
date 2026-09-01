import { Fragment } from 'react'
import DateInput from './DateInput'
import { getStatusInfo, fmtDate, forecastHint } from './progressUtils'
import { auditRowAttrs } from '../common/rowAudit'

// Bảng "Tiến độ theo biên bản" (desktop) — dùng chung cho HĐ BÁN và HĐ NHẬP.
// Cả hai đầu đều có công thức tính ngày: "Ngày theo HĐ" neo theo ngày theo HĐ của
// mốc gốc (hoặc nhập tay), "Ngày dự kiến" neo theo ngày THỰC TẾ của mốc gốc.

// Badge trạng thái nhỏ đặt ngay dưới ngày trong ô (giống "Thời hạn thu" ở Công nợ).
function StatusBadgeInline({ st }) {
  if (!st || st.type === 'unknown') return null
  const icon = st.type === 'ok' ? '✓ '
    : (st.type === 'late' || st.type === 'overdue') ? '⚠ '
    : st.type === 'pending' ? '⏳ ' : ''
  return <span className={`dc-status badge-${st.type}`}>{icon}{st.label}</span>
}

export default function ProgressTable({
  rows, bbTypes, baseOptions, plannedDates, forecasts,
  set, setBase, setHdBase, saveRow, deleteRow, auditTable,
}) {
  return (
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
            <th className="th-penalty">Ghi chú</th>
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
                {...auditRowAttrs(auditTable, row.id)}
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
                    placeholder="Ghi chú..."
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
  )
}
