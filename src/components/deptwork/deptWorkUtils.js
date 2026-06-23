// Helper/hằng số dùng chung cho module Quản lý công việc — KT Cơ điện.
// Tái dùng tối đa từ task hợp đồng để đồng bộ nhãn/màu trạng thái & ưu tiên.
export {
  PRIORITIES, STATUSES, fmtDate, daysUntil, isOverdue, isWarning,
  priorityClass, statusClass, statusModalClass, initials,
} from '../contracts/taskUtils'

export const ORIGIN_LABEL = { internal: 'Nội bộ', customer: 'Khách hàng' }

export const ACCEPT_LABEL = { pending: 'Chờ nhận', accepted: '', rejected: 'Đã từ chối' }

// Chức danh được coi là quản lý phòng việc: Trưởng ban (3), Phó ban (4).
export const MANAGER_POSITION_IDS = [3, 4]

// Người dùng hiện tại có quyền quản lý việc (tạo/giao/sửa/xóa) không.
// Quyền lấy theo chức danh (app_user_position), không còn theo dept_work_member.
export function canManageDeptWork(user) {
  if (Number(user?.role) === 1) return true
  return (user?.positions || []).some(p => MANAGER_POSITION_IDS.includes(p.id))
}

// Tên rút gọn danh sách người nhận, đánh dấu nhóm trưởng.
export function assigneesSummary(assignees) {
  if (!assignees?.length) return 'Chưa giao'
  return assignees
    .map(a => (a.is_lead ? `★ ${a.assignee_name}` : a.assignee_name))
    .join(', ')
}
