import { HEAD_POSITION_IDS } from '../auth/positionIds.js'
import { TECH_DEPT_IDS } from '../auth/departmentIds.js'
import { MEMBER_ROLE_RANK } from '../controllers/contractMemberController.js'

// ─────────────────────────────────────────────────────────────────────────────
// Tự thêm người nhận việc vào DANH SÁCH KỸ THUẬT của hợp đồng khi CHUYỂN VIỆC.
//
// Luật (chỉ áp cho công việc của HĐ bán, lúc chuyển việc):
//   • Người CHUYỂN là Trưởng ban / Phó ban của Ban Dự án & chuyển giao công nghệ
//     hoặc Ban Kỹ thuật, VÀ
//   • Người ĐƯỢC CHUYỂN thuộc một trong hai ban đó, VÀ
//   • Người đó CHƯA có trong danh sách Kỹ thuật của hợp đồng
//   → chèn thêm 1 dòng contract_out_member vai trò 'Technical'.
//
// Cách xác định "là Trưởng/Phó ban của ban X": chức danh lấy từ app_user.position_id
// HOẶC app_user_position (một người giữ nhiều chức danh), phòng lấy theo PHÒNG CHÍNH
// (app_user.department_id) — cùng luật với headDeptIds() trong auth/permissions.js.
// Cách xác định "người của ban X": phòng chính HOẶC ban kiêm nhiệm
// (app_user_department) — cùng cách gom thành viên phòng trong auth/permissions.js.
// ─────────────────────────────────────────────────────────────────────────────

const TECHNICAL_ROLE = 'Technical'

/**
 * Chạy TRONG transaction của lời gọi (truyền `client`, không tự BEGIN/COMMIT).
 * Trả về true nếu vừa chèn thêm thành viên Kỹ thuật, false nếu không áp luật.
 */
export async function autoAddTechnicalMember(client, { contractId, actorId, toUserId }) {
  if (!contractId || !actorId || !toUserId) return false

  // 1 lượt truy vấn cho cả 2 điều kiện về người chuyển / người nhận.
  const { rows } = await client.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM app_user u
          WHERE u.id = $1
            AND u.department_id = ANY($3::int[])
            AND (u.position_id = ANY($4::int[])
                 OR EXISTS (SELECT 1 FROM app_user_position ap
                             WHERE ap.user_id = u.id AND ap.position_id = ANY($4::int[])))
       ) AS actor_is_tech_head,
       EXISTS (
         SELECT 1 FROM app_user u
          WHERE u.id = $2
            AND (u.department_id = ANY($3::int[])
                 OR EXISTS (SELECT 1 FROM app_user_department ud
                             WHERE ud.user_id = u.id AND ud.department_id = ANY($3::int[])))
       ) AS target_is_tech_staff`,
    [actorId, toUserId, TECH_DEPT_IDS, HEAD_POSITION_IDS],
  )
  const { actor_is_tech_head: actorIsHead, target_is_tech_staff: targetIsTech } = rows[0] || {}
  if (!actorIsHead || !targetIsTech) return false

  // ON CONFLICT = "đã có trong danh sách kỹ thuật thì thôi" (uq_contract_member).
  const res = await client.query(
    `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank)
     VALUES ($1, $2, $3, false, $4)
     ON CONFLICT ON CONSTRAINT uq_contract_member DO NOTHING`,
    [contractId, toUserId, TECHNICAL_ROLE, MEMBER_ROLE_RANK[TECHNICAL_ROLE]],
  )
  return res.rowCount > 0
}
