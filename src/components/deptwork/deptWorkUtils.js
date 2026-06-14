// Helper/hằng số dùng chung cho module Quản lý công việc — KT Cơ điện.
// Tái dùng tối đa từ task hợp đồng để đồng bộ nhãn/màu trạng thái & ưu tiên.
export {
  PRIORITIES, STATUSES, fmtDate, daysUntil, isOverdue, isWarning,
  priorityClass, statusClass, statusModalClass, initials,
} from '../contracts/taskUtils'

export const ORIGIN_LABEL = { internal: 'Nội bộ', customer: 'Khách hàng' }

export const ACCEPT_LABEL = { pending: 'Chờ nhận', accepted: '', rejected: 'Đã từ chối' }

// Người dùng hiện tại có quyền quản lý việc (tạo/giao/sửa/xóa) không.
export function canManageDeptWork(user, members) {
  if (Number(user?.role) === 1) return true
  const me = members?.find(m => m.user_id === user?.id)
  return me ? ['HEAD', 'DEPUTY'].includes(me.dept_role) : false
}

// Tên rút gọn danh sách người nhận, đánh dấu nhóm trưởng.
export function assigneesSummary(assignees) {
  if (!assignees?.length) return 'Chưa giao'
  return assignees
    .map(a => (a.is_lead ? `★ ${a.assignee_name}` : a.assignee_name))
    .join(', ')
}
