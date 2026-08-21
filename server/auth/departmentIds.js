// ─────────────────────────────────────────────────────────────────────────────
// NGUỒN CHÂN LÝ DUY NHẤT cho các ID phòng ban được hardcode trong logic nghiệp vụ.
// Neo theo ID (không theo tên) để đổi tên ban không làm gãy luật. ĐỪNG xóa-tạo-lại
// các ban này trong DB (id sẽ đổi); nếu DB môi trường khác (VPS) có id khác, sửa
// TẠI ĐÂY một chỗ duy nhất.
// Song song với auth/positionIds.js (ID chức danh).
// ─────────────────────────────────────────────────────────────────────────────

// Ban Dự án và chuyển giao công nghệ (7) — cũng là ban của module Quản lý công việc
// (trước đây gọi là "Ban KT Cơ điện", xem middleware/deptWorkAccess.js).
export const DEPT_DU_AN_CGCN = 7

// Ban Kỹ thuật (8).
export const DEPT_KY_THUAT = 8

// Hai ban làm KỸ THUẬT của dự án — dùng cho luật tự thêm người vào danh sách Kỹ thuật
// của hợp đồng khi Trưởng/Phó ban chuyển việc (services/autoTechnicalMember.js).
export const TECH_DEPT_IDS = [DEPT_DU_AN_CGCN, DEPT_KY_THUAT]
