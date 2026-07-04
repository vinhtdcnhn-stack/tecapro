import { pool } from '../db.js'
import { userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'
import { userIsHead } from '../middleware/tenderAccess.js'

// Các hàm ĐẾM dùng chung cho cảnh báo/badge — nguồn sự thật duy nhất cho cả endpoint
// long-poll (liveController) lẫn các endpoint /unread-count cũ (giữ tương thích). Tách
// SQL quan hệ phức tạp ra đây để không bị lệch giữa các nơi.

// Số mục dòng thời gian CHƯA ĐỌC trên mọi việc HĐ liên quan (tạo / được giao / PM của HĐ).
export async function contractTaskUnread(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM contract_task_entry e
       JOIN contract_task t ON t.id = e.task_id
       LEFT JOIN contract_task_read r ON r.task_id = e.task_id AND r.user_id = $1
      WHERE e.author_id <> $1
        AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
        AND ( t.created_by = $1
              OR t.assigned_to = $1
              OR EXISTS (SELECT 1 FROM contract_out_member m
                          WHERE m.contract_out_id = t.contract_out_id
                            AND m.member_role = 'PM' AND m.user_id = $1) )`,
    [userId],
  )
  return rows[0]?.count || 0
}

// Số mục dòng thời gian CHƯA ĐỌC trên mọi việc phòng liên quan (trưởng/phó thấy hết).
export async function deptWorkUnread(userId, userRole) {
  const isHead = await userIsHeadOrDeputy(userId, userRole)
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM dept_work_entry e
       JOIN dept_work_task t ON t.id = e.task_id
       LEFT JOIN dept_work_task_read r ON r.task_id = e.task_id AND r.user_id = $1
      WHERE e.author_id <> $1
        AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
        AND ( $2
              OR t.created_by = $1
              OR EXISTS (SELECT 1 FROM dept_work_assignment a
                          WHERE a.task_id = e.task_id AND a.is_active AND a.assignee_id = $1) )`,
    [userId, isHead],
  )
  return rows[0]?.count || 0
}

// Số mục dòng thời gian CHƯA ĐỌC trên mọi ĐẦU VIỆC ĐẤU THẦU liên quan. "Liên quan" =
// người tạo đầu việc / người được giao / người làm thầu gói / Trưởng phòng (thấy hết).
export async function tenderChecklistUnread(userId, userRole) {
  const isHead = await userIsHead(userId, userRole)
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM tender_checklist_entry e
       JOIN tender_checklist_item i ON i.id = e.item_id
       JOIN tender tn ON tn.id = i.tender_id AND COALESCE(tn.is_deleted, false) = false
       LEFT JOIN tender_checklist_read r ON r.item_id = e.item_id AND r.user_id = $1
      WHERE e.author_id <> $1
        AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
        AND ( $2
              OR i.created_by = $1
              OR i.assignee_id = $1
              OR tn.bid_maker_id = $1 )`,
    [userId, isHead],
  )
  return rows[0]?.count || 0
}

// Số đơn đề xuất đang CHỜ CHÍNH MÌNH duyệt (badge menu "Đề xuất").
export async function approvalInboxCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM approval_request r
      WHERE r.status = 'pending'
        AND r.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM approval_request_step s
            JOIN approval_request_step_approver sa ON sa.step_id = s.id
           WHERE s.request_id = r.id
             AND s.step_order = r.current_step
             AND s.status = 'pending'
             AND sa.approver_id = $1
             AND sa.decision = 'pending'
        )`,
    [userId],
  )
  return rows[0]?.count || 0
}

// Gói cả 4 số liệu cảnh báo của một người dùng.
export async function liveCountsFor(user) {
  const [ct, dw, tn, inbox] = await Promise.all([
    contractTaskUnread(user.id),
    deptWorkUnread(user.id, user.role),
    tenderChecklistUnread(user.id, user.role),
    approvalInboxCount(user.id),
  ])
  return { ct, dw, tn, inbox }
}
