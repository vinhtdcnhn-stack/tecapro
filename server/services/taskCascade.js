import { notifyInfo, contractLabel } from './notify.js'

// Tự động cập nhật trạng thái việc CHA theo các việc CON (cây nhiều cấp).
// Quy tắc: một node có việc con sẽ "Hoàn thành" khi MỌI con đã kết thúc
// ('Hoàn thành'/'Hủy') VÀ có ≥1 con 'Hoàn thành' (con toàn 'Hủy' → không auto xong).
// Ngược lại, nếu còn con đang mở mà cha đang 'Hoàn thành' → cha tự về 'Đang thực hiện'.
// Node lá (không có con) giữ nguyên trạng thái do người dùng đặt.
//
// cascadeCompletion(client, startId): chạy TRONG transaction (client). Bắt đầu đánh giá
// tại startId (nếu nó có con) rồi lan LÊN theo parent_task_id; dừng khi 1 cấp không đổi.
// Trả mảng các node đã đổi trạng thái [{ id, contract_out_id, title, assigned_to, created_by, status }]
// để caller báo Telegram (fire-and-forget) SAU khi commit.
export async function cascadeCompletion(client, startId) {
  const changed = []
  let cur = startId != null ? Number(startId) : null

  while (cur != null) {
    const { rows: nodeRows } = await client.query(
      'SELECT id, contract_out_id, title, assigned_to, created_by, status, parent_task_id FROM contract_task WHERE id = $1',
      [cur],
    )
    const node = nodeRows[0]
    if (!node) break

    const { rows: agg } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('Chờ xử lý', 'Đang thực hiện'))::int AS open_cnt,
         COUNT(*) FILTER (WHERE status = 'Hoàn thành')::int                     AS done_cnt,
         COUNT(*)::int                                                          AS total_cnt
       FROM contract_task WHERE parent_task_id = $1`,
      [cur],
    )
    const { open_cnt: open, done_cnt: done, total_cnt: total } = agg[0]

    let nodeChanged = false
    if (total > 0) {
      const shouldComplete = open === 0 && done > 0
      if (shouldComplete && node.status !== 'Hoàn thành') {
        await client.query(
          "UPDATE contract_task SET status = 'Hoàn thành', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
          [cur],
        )
        changed.push({ ...node, status: 'Hoàn thành' })
        nodeChanged = true
      } else if (!shouldComplete && node.status === 'Hoàn thành') {
        await client.query(
          "UPDATE contract_task SET status = 'Đang thực hiện', completed_at = NULL, updated_at = NOW() WHERE id = $1",
          [cur],
        )
        changed.push({ ...node, status: 'Đang thực hiện' })
        nodeChanged = true
      }
    }

    // Node CÓ con mà trạng thái không đổi → tổ tiên cũng không đổi: dừng.
    // Node lá (total=0, chính là node vừa bị tác động) → vẫn đi LÊN cha để cha tự tính.
    if (total > 0 && !nodeChanged) break
    cur = node.parent_task_id != null ? Number(node.parent_task_id) : null
  }

  return changed
}

// Báo Telegram cho các việc cha vừa đổi trạng thái tự động (gọi SAU commit).
export async function notifyCascade(changed) {
  for (const n of changed) {
    try {
      const label = await contractLabel(n.contract_out_id)
      const assignee = Number(n.assigned_to) || null
      const creator = Number(n.created_by) || null
      const msg = `Công việc "${n.title}" (HĐ ${label}) tự chuyển sang "${n.status}" (theo các việc con).`
      if (assignee) notifyInfo([assignee], msg)
      if (creator && creator !== assignee) notifyInfo([creator], msg)
    } catch (e) { console.error('notifyCascade:', e) }
  }
}
