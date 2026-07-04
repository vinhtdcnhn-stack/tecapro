// Chính sách XÓA mục dòng thời gian (báo cáo · chỉ đạo · trao đổi) dùng chung cho cả
// công việc phòng, công việc HĐ và đầu việc đấu thầu:
//   • Tác giả CHỈ được xóa mục của mình trong 3 PHÚT đầu kể từ lúc đăng.
//   • Sau 3 phút, ngay cả tác giả cũng không xóa được.
//   • Admin (role = 1) xóa được bất kỳ lúc nào.
export const ENTRY_DELETE_WINDOW_MS = 3 * 60 * 1000

// entry cần có { author_id, created_at }; user là req.user { id, role }.
export function canDeleteEntry(entry, user) {
  if (!entry || !user) return false
  if (Number(user.role) === 1) return true // admin
  if (Number(entry.author_id) !== Number(user.id)) return false
  const created = new Date(entry.created_at).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < ENTRY_DELETE_WINDOW_MS
}

// Thông báo 403 thống nhất khi không đủ điều kiện xóa.
export const ENTRY_DELETE_DENIED =
  'Chỉ tác giả được xóa nội dung trong 3 phút đầu; sau đó chỉ admin mới xóa được.'
