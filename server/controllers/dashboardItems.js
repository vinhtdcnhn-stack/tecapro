import { pool } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phần dùng chung của MỌI dashboard liệt kê việc (bảng theo dõi TrackingTable ở
// frontend): dashboard PM, "Việc của tôi", "Công việc của phòng", hộp thư "Chưa đọc".
// Tách khỏi pmDashboardController để file đó không vượt ngưỡng 500 dòng.
// ─────────────────────────────────────────────────────────────────────────────

// Cờ "đã báo hoàn thành, chờ người giao việc duyệt" của một dòng việc (contract_task /
// dept_work_task). Việc chờ duyệt mang trạng thái 'Hoàn thành' nhưng vẫn phải nằm lại
// bảng theo dõi kèm dấu ⏳ để người duyệt biết mà vào chốt. Trả null khi việc KHÔNG chờ
// duyệt để trải vào item mà không phình payload (`...pendingInfo(t)`).
export function pendingInfo(t) {
  if (!t?.completion_pending) return null
  return {
    completion_pending: true,
    completion_requested_by_name: t.completion_requested_by_name || null,
    completion_requested_at: t.completion_requested_at || null,
  }
}

// Gắn unread_count cho công việc HĐ ('task'), việc phòng ('dept_work_task') và đầu việc
// đấu thầu ('tender_checklist') — để dashboard tô nền hổ phách dòng việc khi có nội dung
// dòng thời gian chưa đọc (song song chấm chưa đọc trong tab). Sửa items tại chỗ.
export async function attachUnread(items, userId) {
  const taskIds = items.filter(i => i.source_type === 'task').map(i => i.source_id)
  const dwIds   = items.filter(i => i.source_type === 'dept_work_task').map(i => i.source_id)
  const tnIds   = items.filter(i => i.source_type === 'tender_checklist').map(i => i.source_id)
  // entryTbl/readTbl gắn với cột khóa `col` (task_id với HĐ/phòng, item_id với đấu thầu).
  const countUnread = (entryTbl, readTbl, col, ids) =>
    ids.length
      ? pool.query(
          `SELECT e.${col} AS k, COUNT(*)::int AS c
             FROM ${entryTbl} e
             LEFT JOIN ${readTbl} r ON r.${col} = e.${col} AND r.user_id = $1
            WHERE e.author_id <> $1 AND e.${col} = ANY($2)
              AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
            GROUP BY e.${col}`, [userId, ids])
          .then(r => new Map(r.rows.map(x => [String(x.k), x.c])))
      : Promise.resolve(new Map())
  const [ctMap, dwMap, tnMap] = await Promise.all([
    countUnread('contract_task_entry', 'contract_task_read', 'task_id', taskIds),
    countUnread('dept_work_entry', 'dept_work_task_read', 'task_id', dwIds),
    countUnread('tender_checklist_entry', 'tender_checklist_read', 'item_id', tnIds),
  ])
  items.forEach(i => {
    if (i.source_type === 'task') i.unread_count = ctMap.get(String(i.source_id)) || 0
    else if (i.source_type === 'dept_work_task') i.unread_count = dwMap.get(String(i.source_id)) || 0
    else if (i.source_type === 'tender_checklist') i.unread_count = tnMap.get(String(i.source_id)) || 0
  })
}
