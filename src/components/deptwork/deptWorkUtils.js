// Helper/hằng số dùng chung cho module Quản lý công việc — KT Cơ điện.
// Tái dùng tối đa từ task hợp đồng để đồng bộ nhãn/màu trạng thái & ưu tiên.
export {
  PRIORITIES, STATUSES, fmtDate, daysUntil, isOverdue, isWarning,
  priorityClass, statusClass, statusModalClass, initials,
} from '../contracts/taskUtils'

export const ORIGIN_LABEL = { internal: 'Nội bộ', customer: 'Khách hàng' }

export const ACCEPT_LABEL = { pending: 'Chờ nhận', accepted: '', rejected: 'Đã từ chối' }

// Các loại mục trong dòng thời gian trao đổi của việc + nhãn + class màu badge.
export const ENTRY_TYPES = [
  { key: 'report', label: 'Báo cáo' },
  { key: 'directive', label: 'Chỉ đạo' },
  { key: 'decision', label: 'Quyết định' },
  { key: 'discussion', label: 'Trao đổi' },
]
export const ENTRY_TYPE_LABEL = Object.fromEntries(ENTRY_TYPES.map(t => [t.key, t.label]))
export const ENTRY_TYPE_CLASS = {
  report: 'dw-et-report',
  directive: 'dw-et-directive',
  decision: 'dw-et-decision',
  discussion: 'dw-et-discussion',
}

// Loại mục mà người dùng được phép đăng cho một việc, suy từ vai trò (khớp luật server).
// rel: { isCreator, isAssignee, isLead, isHead }
export function allowedEntryTypes(rel) {
  if (!rel) return []
  return ENTRY_TYPES.filter(({ key }) => {
    if (key === 'directive' || key === 'decision') return rel.isHead || rel.isLead
    if (key === 'report') return rel.isAssignee || rel.isHead
    return rel.isHead || rel.isCreator || rel.isAssignee // discussion
  }).map(t => t.key)
}

// Chức danh được coi là quản lý phòng việc: Trưởng ban (3), Phó ban (4).
export const MANAGER_POSITION_IDS = [3, 4]

// Người dùng hiện tại có quyền quản lý việc (tạo/giao/sửa/xóa) không.
// Quyền lấy theo chức danh (app_user_position) — HARDCODE, không qua RBAC.
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
