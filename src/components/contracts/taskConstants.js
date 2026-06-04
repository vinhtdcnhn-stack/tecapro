export const PRIORITIES = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
export const STATUSES   = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

export function statusModalClass(s) {
  return s === 'Chờ xử lý' ? 'selected-waiting' : s === 'Đang thực hiện' ? 'selected-doing' : s === 'Hoàn thành' ? 'selected-done' : 'selected-cancel'
}
