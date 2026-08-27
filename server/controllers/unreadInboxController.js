import { pool } from '../db.js'
import { userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'
import { userIsHead } from '../middleware/tenderAccess.js'
import { pendingInfo } from './dashboardItems.js'

// ──────────────────────────────────────────────────────────────────────────────
// Hộp thư "Chưa đọc": gom MỌI việc có nội dung dòng thời gian chưa đọc với người xem,
// để xem tập trung một chỗ. Trả về cùng định dạng item như các dashboard khác nên tái
// dùng được bảng TrackingTable (kèm chấm + nền hổ phách + ghim/nhắc dùng chung).
//
// Phạm vi "liên quan" phải KHỚP badge đỏ toàn trang (xem services/liveCounts.js) — nếu
// lệch thì nền đỏ báo có việc chưa đọc mà hộp thư lại rỗng:
//   • việc HĐ (contract_task)      → người tạo / được giao / PM của HĐ
//   • việc phòng (dept_work_task)  → trưởng-phó (thấy hết) / người tạo / đang được giao
//   • đầu việc đấu thầu (tender_checklist_item) → trưởng phòng (thấy hết) / người tạo /
//        được giao / người làm thầu gói
//
// KHÔNG cache: hộp thư phải tươi tức thì (đọc xong là rời danh sách). Chỉ vài truy vấn nhẹ
// theo chỉ mục item_id/created_at nên không cần lớp cache như dashboard tổng hợp.
// ──────────────────────────────────────────────────────────────────────────────

const iso = (v) => (v ? String(v).slice(0, 10) : null)

// GET /api/pm/:userId/unread-inbox
export async function getUnreadInbox(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId không hợp lệ' })
  try {
    const [isHead, isTenderHead] = await Promise.all([
      userIsHeadOrDeputy(userId, req.user?.role),
      userIsHead(userId, req.user?.role),
    ])
    const [{ rows: ct }, { rows: dw }, { rows: tn }, { rows: trk }] = await Promise.all([
      pool.query(
        `SELECT t.id, t.contract_out_id, co.contract_no, t.title, t.due_date,
                t.completion_pending, t.completion_requested_at,
                ru.full_name AS completion_requested_by_name,
                COUNT(e.id)::int AS unread_count, MAX(e.created_at) AS last_unread_at
           FROM contract_task_entry e
           JOIN contract_task t ON t.id = e.task_id
           JOIN contract_out co ON co.id = t.contract_out_id AND COALESCE(co.is_deleted, false) = false
           LEFT JOIN app_user ru ON ru.id = t.completion_requested_by
           LEFT JOIN contract_task_read r ON r.task_id = e.task_id AND r.user_id = $1
          WHERE e.author_id <> $1
            AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
            AND ( t.created_by = $1 OR t.assigned_to = $1
                  OR EXISTS (SELECT 1 FROM contract_out_member m
                              WHERE m.contract_out_id = t.contract_out_id
                                AND m.member_role = 'PM' AND m.user_id = $1) )
          GROUP BY t.id, co.contract_no, ru.full_name`, [userId]),
      pool.query(
        `SELECT t.id, t.title, t.due_date,
                t.completion_pending, t.completion_requested_at,
                ru.full_name AS completion_requested_by_name,
                COUNT(e.id)::int AS unread_count, MAX(e.created_at) AS last_unread_at
           FROM dept_work_entry e
           JOIN dept_work_task t ON t.id = e.task_id
           LEFT JOIN app_user ru ON ru.id = t.completion_requested_by
           LEFT JOIN dept_work_task_read r ON r.task_id = e.task_id AND r.user_id = $1
          WHERE e.author_id <> $1
            AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
            AND ( $2 OR t.created_by = $1
                  OR EXISTS (SELECT 1 FROM dept_work_assignment a
                              WHERE a.task_id = e.task_id AND a.is_active AND a.assignee_id = $1) )
          GROUP BY t.id, ru.full_name`, [userId, isHead]),
      pool.query(
        `SELECT i.id, i.title, i.due_date,
                COALESCE(NULLIF(tn.package_code, ''), tn.package_name) AS package_label,
                COUNT(e.id)::int AS unread_count, MAX(e.created_at) AS last_unread_at
           FROM tender_checklist_entry e
           JOIN tender_checklist_item i ON i.id = e.item_id
           JOIN tender tn ON tn.id = i.tender_id AND COALESCE(tn.is_deleted, false) = false
           LEFT JOIN tender_checklist_read r ON r.item_id = e.item_id AND r.user_id = $1
          WHERE e.author_id <> $1
            AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
            AND ( $2 OR i.created_by = $1 OR i.assignee_id = $1 OR tn.bid_maker_id = $1 )
          GROUP BY i.id, tn.package_code, tn.package_name`, [userId, isTenderHead]),
      pool.query(
        'SELECT source_type, source_id, pinned, remind_at FROM pm_dashboard_tracking WHERE user_id = $1', [userId]),
    ])

    const tmap = new Map(trk.map(t => [`${t.source_type}:${t.source_id}`, t]))
    const attach = (it) => {
      const t = tmap.get(`${it.source_type}:${it.source_id}`)
      return { ...it, pinned: t?.pinned || false, remind_at: t?.remind_at ? iso(t.remind_at) : null }
    }

    const items = [
      ...ct.map(t => attach({
        source_type: 'task', source_id: t.id, side: 'Bán',
        contract_id: t.contract_out_id, contract_no: t.contract_no,
        due_date: iso(t.due_date), title: t.title || 'Công việc', kind: 'Công việc',
        sub: 'Hạn hoàn thành', unread_count: t.unread_count, last_unread_at: t.last_unread_at,
        ...pendingInfo(t),
      })),
      ...dw.map(t => attach({
        source_type: 'dept_work_task', source_id: t.id, side: 'Phòng',
        contract_id: null, contract_no: null,
        due_date: iso(t.due_date), title: t.title || 'Công việc', kind: 'Công việc',
        sub: 'KT Cơ điện', unread_count: t.unread_count, last_unread_at: t.last_unread_at,
        ...pendingInfo(t),
      })),
      ...tn.map(t => attach({
        source_type: 'tender_checklist', source_id: t.id, side: 'Thầu',
        contract_id: null, contract_no: t.package_label || null,
        due_date: iso(t.due_date), title: t.title || 'Đầu việc', kind: 'Công việc',
        sub: 'Đấu thầu', unread_count: t.unread_count, last_unread_at: t.last_unread_at,
      })),
    ]
    // Mới chưa đọc lên đầu (TrackingTable vẫn ưu tiên ghim/nhắc trước, rồi tới thứ tự này).
    items.sort((a, b) => String(b.last_unread_at || '').localeCompare(String(a.last_unread_at || '')))

    res.json({ items })
  } catch (err) {
    console.error('getUnreadInbox:', err)
    res.status(500).json({ error: 'Không thể tải hộp thư chưa đọc' })
  }
}
