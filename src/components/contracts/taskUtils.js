// Shared constants & helpers for the task tab and its sub-components.

export const PRIORITIES = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
export const STATUSES   = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

export function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000)
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  return daysUntil(task.due_date) < 0
}

export function isWarning(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  const d = daysUntil(task.due_date)
  return d >= 0 && d <= 3
}

export function priorityClass(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' : p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
export function statusClass(s) {
  return s === 'Chờ xử lý' ? 'status--waiting' : s === 'Đang thực hiện' ? 'status--doing' : s === 'Hoàn thành' ? 'status--done' : 'status--cancel'
}
export function statusModalClass(s) {
  return s === 'Chờ xử lý' ? 'selected-waiting' : s === 'Đang thực hiện' ? 'selected-doing' : s === 'Hoàn thành' ? 'selected-done' : 'selected-cancel'
}

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
}
