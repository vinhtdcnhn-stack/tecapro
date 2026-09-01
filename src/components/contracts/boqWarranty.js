// Tính hiệu lực bảo hành cho DÒNG BẢNG GIÁ (dùng chung đầu bán + đầu nhập).
//
// Quy ước:
//   - Ngày BẮT ĐẦU = ngày THỰC TẾ (actual_date) của biên bản được gán làm mốc.
//     Biên bản chưa ký (chưa có ngày thực tế) ⇒ chưa có ngày bắt đầu.
//   - Ngày KẾT THÚC = ngày bắt đầu + số tháng bảo hành.
//   - Dòng bỏ trống mốc/số tháng ⇒ lấy MẶC ĐỊNH của cả bảng giá (cấp hợp đồng).
import { daysUntil } from '../../lib/dateOnly'

const pad = (n) => String(n).padStart(2, '0')

// Cộng N tháng vào ngày ISO 'yyyy-mm-dd' (kẹp về cuối tháng nếu tràn, vd 31/1 + 1 tháng = 28/2).
export function addMonths(iso, months) {
  const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const n = parseInt(months, 10)
  if (!m || !Number.isFinite(n)) return ''
  const y = +m[1], mo = +m[2], d = +m[3]
  const dt = new Date(y, mo - 1 + n, 1)
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  dt.setDate(Math.min(d, lastDay))
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

// Số tháng hợp lệ để hiển thị/lưu: nguyên 0..1200, ngoài khoảng → null.
export function normMonths(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 && n <= 1200 ? n : null
}

// Hiệu lực bảo hành của 1 dòng.
//   row      : dòng bảng giá (warranty_bb_id, warranty_months)
//   fallback : mặc định cấp hợp đồng { bbId, months }
//   bbById   : Map id(chuỗi) → { id, date, label } từ useBienBanOptions
// Trả: { bbId, months, from, to, usesDefault, bbLabel, hasBBDate }
export function rowWarranty(row, fallback, bbById) {
  const rowBB     = row?.warranty_bb_id  != null && row.warranty_bb_id  !== '' ? String(row.warranty_bb_id) : null
  const rowMonths = normMonths(row?.warranty_months)
  const bbId   = rowBB     ?? (fallback?.bbId != null ? String(fallback.bbId) : null)
  const months = rowMonths ?? normMonths(fallback?.months)
  const bb     = bbId ? bbById?.get(bbId) : null
  const from   = bb?.date || ''
  const to     = from && months != null ? addMonths(from, months) : ''
  return {
    bbId, months, from, to,
    usesDefault: rowBB == null && rowMonths == null && (bbId != null || months != null),
    bbLabel: bb?.label || '',
    hasBBDate: !!from,
  }
}

// Nhãn trạng thái cho khoảng bảo hành đã tính (dùng chung màu với tab Bảo hành).
// Chưa đủ dữ liệu → null (ô để trống, kèm gợi ý thiếu gì).
export function warrantyRangeStatus(w) {
  if (!w.to) return null
  const days = daysUntil(w.to)
  if (days < 0)   return { label: 'Hết bảo hành', cls: 'bwty-badge--expired' }
  if (days <= 30) return { label: `Còn ${days} ngày`, cls: 'bwty-badge--expiring' }
  return { label: 'Còn bảo hành', cls: 'bwty-badge--active' }
}

// Vì sao chưa tính ra ngày — hiện làm gợi ý mờ trong ô "Hiệu lực BH".
export function warrantyMissingHint(w) {
  if (!w.bbId && w.months == null) return 'Chưa đặt mốc BH'
  if (!w.bbId)      return 'Chưa chọn biên bản mốc'
  if (!w.hasBBDate) return 'Biên bản chưa có ngày thực tế'
  if (w.months == null) return 'Chưa nhập số tháng'
  return ''
}
