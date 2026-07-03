// ─────────────────────────────────────────────────────────────────────────────
// NGUỒN CHÂN LÝ DUY NHẤT cho các ID vị trí được hardcode trong logic phân quyền.
// Neo theo ID (không theo mã) để đổi tên/mã vị trí không làm gãy kế thừa quyền.
// ĐỪNG xóa-tạo-lại các vị trí này trong DB (id sẽ đổi); nếu DB môi trường khác
// (VPS) có id khác, sửa TẠI ĐÂY một chỗ duy nhất.
// Dùng bởi: auth/permissions.js (kế thừa TP/PP), auth/seedPermissions.js (seed
// dashboard.dept.view + co.boq.lock), middleware/deptWorkAccess.js (quản lý phòng việc).
// ─────────────────────────────────────────────────────────────────────────────

// Trưởng ban (3) / Phó ban (4).
export const HEAD_POSITION_IDS = [3, 4]
