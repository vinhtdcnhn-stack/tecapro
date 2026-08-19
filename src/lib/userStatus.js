// Trạng thái làm việc của nhân sự (app_user.is_active).
//
// Người nghỉ việc KHÔNG bị xóa khỏi hệ thống — mọi dữ liệu quá khứ (HĐ, công việc, biên bản,
// nhật ký...) vẫn phải tra được tên họ. Thay vào đó tài khoản được đánh dấu "đã nghỉ":
//   • không đăng nhập được nữa (chặn ở server: login + requireAuth)
//   • không hiện trong các ô CHỌN người để giao việc mới
//   • NHƯNG vẫn hiện nếu đang được gán sẵn ở bản ghi cũ, kèm nhãn "(đã nghỉ)" để người dùng
//     biết mà chuyển việc — nếu lọc thẳng ra thì ô chọn sẽ trống trơn và lần lưu kế tiếp
//     vô tình xóa mất người phụ trách cũ.
//
// Bản ghi từ cache cũ có thể thiếu field is_active → coi như đang làm việc (mặc định an toàn).

export const INACTIVE_SUFFIX = ' (đã nghỉ)'

export function isUserActive(u) {
  return u?.is_active !== false
}

/** Chuẩn hóa danh sách id "đang được chọn" (số/chuỗi lẫn lộn) thành Set chuỗi. */
function keepSet(keepIds) {
  const arr = keepIds == null ? [] : Array.isArray(keepIds) ? keepIds : [keepIds]
  return new Set(arr.filter(v => v !== '' && v != null).map(String))
}

/**
 * Lọc danh sách người cho ô chọn: giữ người đang làm việc + những người đã nghỉ đang được
 * gán sẵn (keepIds).
 */
export function selectableUsers(users = [], keepIds) {
  const keep = keepSet(keepIds)
  return users.filter(u => isUserActive(u) || keep.has(String(u.id)))
}

/** Nhãn hiển thị: gắn "(đã nghỉ)" cho người không còn làm việc. */
export function userLabel(u, fallback = '') {
  const name = u?.full_name || u?.email || fallback || `#${u?.id}`
  return isUserActive(u) ? name : name + INACTIVE_SUFFIX
}
