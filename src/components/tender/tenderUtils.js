// Hằng số & helper dùng chung cho module Quản lý Đấu thầu (Ban Kế hoạch Đấu thầu).

export const FIELDS = ['Hạ tầng', 'CNTT']
export const RESULTS = ['Trúng', 'Trượt', 'Hủy']

// Trạng thái workflow của gói thầu (theo luồng nghiệp vụ).
export const WORKFLOW = [
  'Khởi tạo', 'Đã phân công', 'Lập checklist', 'Đang thực hiện',
  'Chờ review', 'Đạt', 'Chưa đạt', 'Sẵn sàng in/ký', 'Có kết quả',
]

// Màu badge theo trạng thái (nền nhạt + chữ đậm).
const STATUS_COLORS = {
  'Khởi tạo':        { bg: '#f1f5f9', fg: '#475569' },
  'Đã phân công':    { bg: '#e0f2fe', fg: '#0369a1' },
  'Lập checklist':   { bg: '#ede9fe', fg: '#6d28d9' },
  'Đang thực hiện':  { bg: '#fef9c3', fg: '#a16207' },
  'Chờ review':      { bg: '#ffedd5', fg: '#c2410c' },
  'Đạt':             { bg: '#dcfce7', fg: '#15803d' },
  'Chưa đạt':        { bg: '#fee2e2', fg: '#b91c1c' },
  'Sẵn sàng in/ký':  { bg: '#dbeafe', fg: '#1d4ed8' },
  'Có kết quả':      { bg: '#f3e8ff', fg: '#7e22ce' },
}
export function statusColor(status) {
  return STATUS_COLORS[status] || { bg: '#f1f5f9', fg: '#475569' }
}

// Trạng thái làm thầu (tiến độ nộp hồ sơ) — độc lập với WORKFLOW workflow_status.
export const BID_STATUSES = ['Đang làm thầu', 'Đã nộp thầu']
const BID_STATUS_COLORS = {
  'Đang làm thầu': { bg: '#fef9c3', fg: '#a16207' },
  'Đã nộp thầu':   { bg: '#dcfce7', fg: '#15803d' },
}
export function bidStatusColor(status) {
  return BID_STATUS_COLORS[status] || { bg: '#f1f5f9', fg: '#475569' }
}

const RESULT_COLORS = {
  'Trúng': { bg: '#dcfce7', fg: '#15803d' },
  'Trượt': { bg: '#fee2e2', fg: '#b91c1c' },
  'Hủy':   { bg: '#f1f5f9', fg: '#64748b' },
}
export function resultColor(result) {
  return RESULT_COLORS[result] || null
}

// Đơn vị tiền tệ hỗ trợ cho dự toán gói thầu (VND + ngoại tệ cho gói quốc tế).
export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY']

// Định dạng tiền — phân tách hàng nghìn kiểu vi-VN (số nguyên tệ, chưa kèm đơn vị).
export function fmtMoney(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('vi-VN')
}

// Ký hiệu đơn vị tiền: VND → "đ", ngoại tệ → mã (USD/EUR/JPY).
export function ccySuffix(ccy) {
  return !ccy || ccy === 'VND' ? 'đ' : ccy
}

// Định dạng dự toán kèm đơn vị nguyên tệ, ví dụ "1.000.000 đ" hoặc "50.000 USD".
export function fmtAmount(v, ccy) {
  const s = fmtMoney(v)
  return s ? `${s} ${ccySuffix(ccy)}` : ''
}

// ISO 'yyyy-mm-dd' → 'dd/mm/yyyy'.
export function fmtDate(iso) {
  if (!iso) return ''
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Số ngày còn lại tới hạn nộp (âm = quá hạn). null nếu không có ngày.
export function daysUntil(iso) {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(String(iso).slice(0, 10)); d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

// Quyền: ai là Trưởng phòng (HEAD) trong danh sách thành viên.
export function isHeadUser(user, members) {
  if (Number(user?.role) === 1) return true
  const me = members?.find(m => Number(m.user_id) === Number(user?.id))
  return me?.dept_role === 'HEAD'
}
