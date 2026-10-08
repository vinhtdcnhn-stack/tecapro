import { pool } from '../db.js'
import { HEAD_POSITION_IDS } from './positionIds.js'
import { DEPT_TRIEN_KHAI_DU_AN } from './departmentIds.js'

// Trạng thái "Hoàn thành" của HĐ bán (contract_out.status). Khi ở trạng thái này, trigger
// trg_contract_freeze (migration 108) chặn mọi ghi vào HĐ + các thành phần (trừ bảo hành).
export const COMPLETED = 'Completed'

// Ai được chuyển HĐ SANG hoặc RA KHỎI "Hoàn thành": admin, hoặc người giữ chức Trưởng/Phó
// ban (HEAD_POSITION_IDS) VÀ thuộc Ban Triển khai Dự án — tính cả ban chính lẫn ban kiêm
// nhiệm (app_user_department). Chức danh lấy từ position_id hoặc app_user_position.
export async function canToggleCompletion(user) {
  if (!user) return false
  if (Number(user.role) === 1) return true
  const { rows } = await pool.query(
    `SELECT 1 FROM app_user u
      WHERE u.id = $1 AND COALESCE(u.is_active, true)
        AND (u.department_id = $2
             OR EXISTS (SELECT 1 FROM app_user_department d WHERE d.user_id = u.id AND d.department_id = $2))
        AND (u.position_id = ANY($3::int[])
             OR EXISTS (SELECT 1 FROM app_user_position p WHERE p.user_id = u.id AND p.position_id = ANY($3::int[])))
      LIMIT 1`,
    [user.id, DEPT_TRIEN_KHAI_DU_AN, HEAD_POSITION_IDS],
  )
  return rows.length > 0
}

// Đổi trạng thái có chạm tới "Hoàn thành" (vào hoặc ra) hay không.
export const touchesCompletion = (oldStatus, newStatus) =>
  (oldStatus === COMPLETED) !== (newStatus === COMPLETED)

export const COMPLETION_DENIED_MSG =
  'Chỉ Trưởng/Phó Ban Triển khai Dự án (hoặc quản trị) mới được chuyển hợp đồng sang/khỏi trạng thái "Hoàn thành".'
