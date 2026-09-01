// Số tháng bảo hành của một dòng bảng giá (dùng chung đầu bán + đầu nhập).
//
// Bảng giá lưu 2 thứ: `warranty_period` (chữ tự do, VD "36 tháng — bảo hành tại chỗ")
// và `warranty_months` (số tháng để cộng ra ngày hết hạn từ mốc biên bản).
// Nhập Excel chỉ có cột chữ → đọc luôn số tháng ra từ chữ để khỏi phải gõ lại.

// "36 tháng" → 36 ; "3 năm" → 36 ; "24T"/"24" → 24 ; không đọc được → null.
export function parseWarrantyMonths(text) {
  const s = String(text ?? '').toLowerCase().trim()
  if (!s) return null
  const months = s.match(/(\d+)\s*(th[aá]ng|thg|t\b)/)
  if (months) return clampMonths(months[1])
  const years = s.match(/(\d+)\s*(n[aă]m|y)/)
  if (years) return clampMonths(Number(years[1]) * 12)
  const bare = s.match(/^(\d+)$/)
  return bare ? clampMonths(bare[1]) : null
}

// Số tháng hợp lệ: nguyên, 0..1200 (100 năm). Ngoài khoảng → null.
export function clampMonths(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseInt(v, 10)
  if (!Number.isFinite(n) || n < 0 || n > 1200) return null
  return n
}

// id biên bản: số nguyên dương, còn lại → null (client gửi '' khi bỏ chọn).
export function bbIdOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
