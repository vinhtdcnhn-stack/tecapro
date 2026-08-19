// Ngày "chỉ có ngày" (cột DATE của Postgres trả về nguyên chuỗi 'yyyy-mm-dd').
//
// Bẫy: new Date('2026-08-17') được hiểu là NỬA ĐÊM UTC, ở múi giờ VN (UTC+7) thành
// 07:00 ngày 17. Đem trừ cho "nửa đêm hôm nay" theo giờ máy sẽ lệch 7 tiếng, khiến
// Math.ceil nuốt mất một ngày: hôm 18/8 mà hạn 17/8 vẫn ra "còn 0 ngày" thay vì
// "quá hạn 1 ngày". Vì vậy MỌI phép so ngày ở giao diện phải đi qua các hàm dưới đây,
// tính theo thành phần năm/tháng/ngày nên không phụ thuộc múi giờ.

// 'yyyy-mm-dd' (hoặc chuỗi ISO đầy đủ) → mốc UTC của đúng ngày đó, hoặc null.
function utcOf(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d)
}

// Hôm nay theo LỊCH MÁY, quy về cùng hệ quy chiếu với utcOf.
function todayUTC() {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

// Hôm nay dạng 'yyyy-mm-dd' theo lịch máy.
export function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Số ngày còn lại tới `dateStr`: 0 = đúng hôm nay, âm = đã qua hạn bấy nhiêu ngày.
export function daysUntil(dateStr) {
  const t = utcOf(dateStr)
  if (t === null) return null
  return Math.round((t - todayUTC()) / 86400000)
}

// Số ngày từ `fromStr` đến `toStr` (dương nếu `toStr` sau).
export function daysBetween(fromStr, toStr) {
  const a = utcOf(fromStr), b = utcOf(toStr)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86400000)
}

// dateStr đã qua so với hôm nay (chưa tính hôm nay là quá hạn).
export function isPast(dateStr) {
  const d = daysUntil(dateStr)
  return d !== null && d < 0
}
