// Shared constants & helpers for the contract-in delivery tab.

export const DELIVERY_STATUSES = ['Chờ nhận', 'Đang nhận', 'Đã nhận đủ', 'Nhận một phần']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtNum  = (n) => new Intl.NumberFormat('vi-VN').format(parseFloat(n) || 0)

export function statusStyle(s) {
  if (s === 'Đã nhận đủ')     return { background: '#dcfce7', color: '#15803d' }
  if (s === 'Nhận một phần')  return { background: '#fef9c3', color: '#a16207' }
  if (s === 'Đang nhận')      return { background: '#dbeafe', color: '#1d4ed8' }
  return { background: '#f3f4f6', color: '#6b7280' }
}
