// ─────────────────────────────────────────────────────────────────────────────
// Bản GƯƠNG phía giao diện của server/auth/departmentIds.js + positionIds.js.
// Chỉ dùng để HIỂN THỊ gợi ý/nhãn — mọi luật thật vẫn do backend quyết định.
// Sửa ID ở server thì sửa luôn ở đây.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPT_DU_AN_CGCN = 7   // Ban Dự án và chuyển giao công nghệ
export const DEPT_KY_THUAT   = 8   // Ban Kỹ thuật

// Hai ban làm KỸ THUẬT của dự án.
export const TECH_DEPT_IDS = [DEPT_DU_AN_CGCN, DEPT_KY_THUAT]

// Trưởng ban (3) / Phó ban (4).
export const HEAD_POSITION_IDS = [3, 4]

const inDepts = (id, ids) => ids.some(d => String(d) === String(id))

// "Người của ban kỹ thuật": phòng chính HOẶC ban kiêm nhiệm (extra_departments).
export function isTechDeptStaff(user) {
  if (!user) return false
  if (inDepts(user.department_id, TECH_DEPT_IDS)) return true
  return (user.extra_departments || []).some(d => inDepts(d?.id, TECH_DEPT_IDS))
}

// "Trưởng/Phó ban kỹ thuật": giữ chức danh Trưởng/Phó ban VÀ phòng chính là 1 trong 2 ban.
export function isTechDeptHead(user) {
  if (!user || !inDepts(user.department_id, TECH_DEPT_IDS)) return false
  return (user.positions || []).some(p => HEAD_POSITION_IDS.some(id => String(id) === String(p?.id)))
}
