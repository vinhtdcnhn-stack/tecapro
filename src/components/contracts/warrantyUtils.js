// Shared constants & helpers for the warranty tab and its sub-components.

export const CASE_STATUSES   = ['Tiếp nhận', 'Đang xử lý', 'Chờ phụ kiện', 'Hoàn thành', 'Đóng']
export const PRIORITIES      = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
export const ACTIVITY_TYPES  = ['Tiếp nhận', 'Kiểm tra hiện trường', 'Khắc phục', 'Thay thế thiết bị', 'Cập nhật tình trạng', 'Hoàn thành', 'Khác']
export const SERIAL_STATUSES = ['Đang hoạt động', 'Lỗi', 'Đã thay thế', 'Ngừng sử dụng']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtDT   = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—'

export function toISODate(val) {
  if (!val && val !== 0) return null
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`
  }
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (!isNaN(n) && n > 1) {
    // Excel serial → UTC date (Excel epoch = Dec 30, 1899; Unix epoch offset = 25569 days)
    const d = new Date(Math.round((n - 25569) * 864e5))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  }
  return String(val).trim() || null
}

export function warrantyStatus(to) {
  if (!to) return { label: 'Không xác định', cls: 'wty-badge--none' }
  const days = Math.ceil((new Date(to) - new Date(new Date().toDateString())) / 86400000)
  if (days < 0)  return { label: 'Hết bảo hành', cls: 'wty-badge--expired' }
  if (days <= 30) return { label: `Còn ${days} ngày`, cls: 'wty-badge--expiring' }
  return { label: 'Còn bảo hành', cls: 'wty-badge--active' }
}

export function caseStatusCls(s) {
  return s === 'Tiếp nhận' ? 'cs--receive' : s === 'Đang xử lý' ? 'cs--progress' :
    s === 'Chờ phụ kiện' ? 'cs--waiting' : s === 'Hoàn thành' ? 'cs--done' : 'cs--closed'
}
export function caseStatusModalCls(s) {
  return s === 'Tiếp nhận' ? 'sel-receive' : s === 'Đang xử lý' ? 'sel-progress' :
    s === 'Chờ phụ kiện' ? 'sel-waiting' : s === 'Hoàn thành' ? 'sel-done' : 'sel-closed'
}
export function priorityCls(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' :
    p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
export function activityIcon(type) {
  return type === 'Tiếp nhận' ? '📥' : type === 'Kiểm tra hiện trường' ? '🔍' :
    type === 'Khắc phục' ? '🔧' : type === 'Thay thế thiết bị' ? '🔄' :
    type === 'Hoàn thành' ? '✅' : '📝'
}
