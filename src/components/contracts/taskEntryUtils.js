// Hằng số / helper cho dòng thời gian trao đổi của CÔNG VIỆC HỢP ĐỒNG.
// Song song bản dept-work nhưng mô hình quyền của HĐ chỉ có: người tạo / người được
// giao / quản lý (PM của HĐ hoặc admin). Logic khớp canPost ở taskEntryController.js.

export const ENTRY_TYPES = [
  { key: 'report', label: 'Báo cáo' },
  { key: 'directive', label: 'Chỉ đạo' },
  { key: 'decision', label: 'Quyết định' },
  { key: 'discussion', label: 'Trao đổi' },
]
export const ENTRY_TYPE_LABEL = Object.fromEntries(ENTRY_TYPES.map(t => [t.key, t.label]))
export const ENTRY_TYPE_CLASS = {
  report: 'task-et-report',
  directive: 'task-et-directive',
  decision: 'task-et-decision',
  discussion: 'task-et-discussion',
}

// Loại mục mà người dùng được phép đăng cho một việc, suy từ vai trò (khớp luật server).
// rel: { isCreator, isAssignee, isManager }
export function allowedEntryTypes(rel) {
  if (!rel) return []
  return ENTRY_TYPES.filter(({ key }) => {
    if (key === 'directive' || key === 'decision') return rel.isManager
    if (key === 'report') return rel.isAssignee || rel.isManager
    return rel.isManager || rel.isCreator || rel.isAssignee // discussion
  }).map(t => t.key)
}

// Chính sách XÓA mục dòng thời gian: tác giả CHỈ được xóa trong 3 phút đầu; sau đó chỉ
// admin (role = 1). Khớp gác backend ở server/utils/entryDelete.js.
export const ENTRY_DELETE_WINDOW_MS = 3 * 60 * 1000
export function canDeleteEntry(entry, currentUser) {
  if (!entry || !currentUser) return false
  if (Number(currentUser.role) === 1) return true // admin xóa bất kỳ lúc nào
  if (Number(entry.author_id) !== Number(currentUser.id)) return false
  const created = new Date(entry.created_at).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < ENTRY_DELETE_WINDOW_MS
}

// dd/mm/yyyy HH:mm cho mốc thời gian của mục.
export function fmtDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
