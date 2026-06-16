// Duyệt / từ chối đơn ở BƯỚC HIỆN TẠI. Suy quyền từ req.user — chỉ người duyệt
// đang 'pending' của bước hiện tại mới thao tác được.
import { pool } from '../db.js'
import { notifyAction, notifyInfo } from '../services/notify.js'

// Lấy bước hiện tại + dòng người duyệt của chính tôi (đã khóa hàng đơn).
// Trả { error, code } nếu không hợp lệ, hoặc { reqRow, step, myRow }.
async function loadCurrent(client, id, userId) {
  const { rows: reqs } = await client.query(
    `SELECT id, requester_id, title, status, current_step FROM approval_request WHERE id = $1 FOR UPDATE`,
    [id]
  )
  if (!reqs.length) return { code: 404, error: 'Không tìm thấy đơn.' }
  const reqRow = reqs[0]
  if (reqRow.status !== 'pending') return { code: 409, error: 'Đơn không ở trạng thái chờ duyệt.' }

  const { rows: steps } = await client.query(
    `SELECT id, name, rule, status FROM approval_request_step
      WHERE request_id = $1 AND step_order = $2`,
    [id, reqRow.current_step]
  )
  if (!steps.length || steps[0].status !== 'pending') return { code: 409, error: 'Bước duyệt hiện tại không hợp lệ.' }
  const step = steps[0]

  const { rows: mine } = await client.query(
    `SELECT id, decision FROM approval_request_step_approver WHERE step_id = $1 AND approver_id = $2`,
    [step.id, userId]
  )
  if (!mine.length) return { code: 403, error: 'Bạn không phải người duyệt của bước này.' }
  if (mine[0].decision !== 'pending') return { code: 409, error: 'Bạn đã xử lý bước này rồi.' }
  return { reqRow, step, myRow: mine[0] }
}

export async function approveRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const comment = req.body?.comment?.trim() || null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ctx = await loadCurrent(client, id, req.user.id)
    if (ctx.error) { await client.query('ROLLBACK'); return res.status(ctx.code).json({ error: ctx.error }) }
    const { reqRow, step } = ctx

    // Ghi quyết định DUYỆT cho TẤT CẢ các bước mà tôi là người duyệt còn 'pending'
    // → một người xuất hiện ở nhiều cấp chỉ cần duyệt 1 lần cho mọi cấp.
    await client.query(
      `UPDATE approval_request_step_approver AS sa
          SET decision = 'approved', comment = COALESCE(sa.comment, $1), decided_at = now()
         FROM approval_request_step s
        WHERE sa.step_id = s.id AND s.request_id = $2
          AND sa.approver_id = $3 AND sa.decision = 'pending'`,
      [comment, id, req.user.id]
    )

    // "Thông" tuần tự từ bước hiện tại: bước nào đã đủ điều kiện thì duyệt và tiến tiếp;
    // dừng ở bước đầu tiên còn phải chờ người khác. Nhờ bước trên, các cấp có cùng người
    // (đã auto-duyệt) sẽ tự qua.
    let cur = reqRow.current_step
    let completed = false
    while (true) {
      const { rows: sRows } = await client.query(
        `SELECT id, rule, status FROM approval_request_step WHERE request_id = $1 AND step_order = $2`,
        [id, cur]
      )
      if (!sRows.length) { completed = true; break }       // hết bước → hoàn tất
      const st = sRows[0]
      if (st.status !== 'pending') { cur += 1; continue }   // bước đã duyệt → bỏ qua
      let satisfied
      if (st.rule === 'all') {
        const { rows } = await client.query(
          `SELECT COUNT(*)::int AS n FROM approval_request_step_approver WHERE step_id = $1 AND decision = 'pending'`, [st.id])
        satisfied = rows[0].n === 0
      } else {
        const { rows } = await client.query(
          `SELECT COUNT(*)::int AS n FROM approval_request_step_approver WHERE step_id = $1 AND decision = 'approved'`, [st.id])
        satisfied = rows[0].n > 0
      }
      if (!satisfied) break                                 // còn chờ người khác → dừng tại đây
      await client.query(`UPDATE approval_request_step SET status = 'approved', decided_at = now() WHERE id = $1`, [st.id])
      cur += 1
    }

    const advanced = !completed && cur !== reqRow.current_step
    let nextApprovers = []
    if (completed) {
      await client.query(`UPDATE approval_request SET status = 'approved', completed_at = now(), updated_at = now() WHERE id = $1`, [id])
    } else if (advanced) {
      await client.query(`UPDATE approval_request SET current_step = $1, updated_at = now() WHERE id = $2`, [cur, id])
      const { rows: ap } = await client.query(
        `SELECT sa.approver_id FROM approval_request_step_approver sa
           JOIN approval_request_step s ON s.id = sa.step_id
          WHERE s.request_id = $1 AND s.step_order = $2 AND sa.decision = 'pending'`, [id, cur])
      nextApprovers = ap.map(a => a.approver_id)
    }

    await client.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type, detail)
       VALUES ($1, $2, 'approved', $3)`,
      [id, req.user.id, JSON.stringify({ step: step.name, comment })]
    )
    if (completed) {
      await client.query(
        `INSERT INTO approval_request_event (request_id, actor_id, event_type) VALUES ($1, $2, 'completed')`,
        [id, req.user.id]
      )
    }
    await client.query('COMMIT')

    // Thông báo (fire-and-forget, sau commit).
    if (advanced && nextApprovers.length) notifyAction(nextApprovers, `Bạn có đơn cần duyệt: ${reqRow.title}`)
    if (completed) notifyInfo([reqRow.requester_id], `Đơn của bạn đã được duyệt xong: ${reqRow.title}`)

    res.json({ success: true, status: completed ? 'approved' : 'pending', advanced, completed })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('approveRequest:', err)
    res.status(500).json({ error: 'Không thể duyệt đơn.' })
  } finally {
    client.release()
  }
}

export async function rejectRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const comment = req.body?.comment?.trim() || null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ctx = await loadCurrent(client, id, req.user.id)
    if (ctx.error) { await client.query('ROLLBACK'); return res.status(ctx.code).json({ error: ctx.error }) }
    const { reqRow, step } = ctx

    await client.query(
      `UPDATE approval_request_step_approver SET decision = 'rejected', comment = $1, decided_at = now() WHERE id = $2`,
      [comment, ctx.myRow.id]
    )
    await client.query(`UPDATE approval_request_step SET status = 'rejected', decided_at = now() WHERE id = $1`, [step.id])
    await client.query(`UPDATE approval_request SET status = 'rejected', completed_at = now(), updated_at = now() WHERE id = $1`, [id])
    await client.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type, detail)
       VALUES ($1, $2, 'rejected', $3)`,
      [id, req.user.id, JSON.stringify({ step: step.name, comment })]
    )
    await client.query('COMMIT')

    const reason = comment ? `\nLý do: ${comment}` : ''
    notifyInfo([reqRow.requester_id], `Đơn của bạn bị từ chối ở bước "${step.name}": ${reqRow.title}${reason}`)

    res.json({ success: true, status: 'rejected' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('rejectRequest:', err)
    res.status(500).json({ error: 'Không thể từ chối đơn.' })
  } finally {
    client.release()
  }
}
