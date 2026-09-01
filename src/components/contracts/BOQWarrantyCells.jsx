import { isoToDisplay } from './DateInput'
import { rowWarranty, warrantyRangeStatus, warrantyMissingHint } from './boqWarranty'

// Hai ô bảo hành của bảng giá (dùng chung đầu bán + đầu nhập):
//   <WarrantyInputCell> — nhập số tháng + chọn biên bản làm mốc bắt đầu
//   <WarrantyRangeCell> — chỉ đọc: ngày bắt đầu → ngày hết hạn + trạng thái
// Dòng để trống thì kế thừa mốc/số tháng mặc định của cả bảng giá (fallback).

// fallback: { bbId, months } — mặc định cấp hợp đồng, dùng khi dòng bỏ trống.
export function WarrantyInputCell({ row, set, bbList, fallback, disabled = false }) {
  const rowBB     = row.warranty_bb_id != null && row.warranty_bb_id !== '' ? String(row.warranty_bb_id) : ''
  const defBB     = fallback?.bbId != null ? bbList.find(b => b.id === String(fallback.bbId)) : null
  const defMonths = fallback?.months
  const inherited = rowBB === ''

  return (
    <td className="td-warranty">
      <div className="bwty-cell">
        <div className="bwty-months-row">
          <input
            className="bwty-months"
            type="number"
            min="0"
            max="1200"
            step="1"
            disabled={disabled}
            value={row.warranty_months ?? ''}
            onChange={e => set(row._key, 'warranty_months', e.target.value === '' ? null : e.target.value)}
            placeholder={defMonths != null ? String(defMonths) : '0'}
            title={row.warranty_period
              ? `Ghi chú bảo hành đã nhập trước đây: ${row.warranty_period}`
              : 'Số tháng bảo hành. Để trống = theo mặc định của bảng giá.'}
          />
          <span className="bwty-unit">tháng</span>
        </div>
        <select
          className={`bwty-bb${inherited ? ' bwty-bb--inherit' : ''}`}
          disabled={disabled}
          value={rowBB}
          onChange={e => set(row._key, 'warranty_bb_id', e.target.value || null)}
          title="Biên bản làm mốc bắt đầu bảo hành (lấy ngày thực tế của biên bản)"
        >
          <option value="">
            {defBB ? `↳ mặc định: ${defBB.name}` : '— chưa chọn biên bản —'}
          </option>
          {bbList.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>
    </td>
  )
}

export function WarrantyRangeCell({ row, bbById, fallback }) {
  const w = rowWarranty(row, fallback, bbById)
  const status = warrantyRangeStatus(w)

  if (!status) {
    return (
      <td className="td-wty-range">
        <span className="bwty-missing">{warrantyMissingHint(w)}</span>
      </td>
    )
  }
  return (
    <td className="td-wty-range">
      <div className="bwty-range" title={w.bbLabel ? `Mốc: ${w.bbLabel}` : undefined}>
        {isoToDisplay(w.from)} → {isoToDisplay(w.to)}
      </div>
      <span className={`bwty-badge ${status.cls}`}>{status.label}</span>
    </td>
  )
}
