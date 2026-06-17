// Thao tác quản trị trên đơn đề xuất (chỉ admin): xóa mềm + khôi phục.
// Tách riêng khỏi approvalRequestController để giữ file dưới 500 dòng.
import { pool } from '../db.js'
import { notifyAction } from '../services/notify.js'

// ── Admin XÓA MỀM một đơn (bất kỳ trạng thái, kể cả đã duyệt) ─────────────────
// Không xóa cứng: đánh dấu deleted_* + lưu lý do + ghi sự kiện. Đơn vẫn hiển thị
// (gạch ngang) để tránh nhầm lẫn. Báo người gửi biết đơn đã bị xóa.
export async function adminDeleteRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const reason = String(req.body?.reason ?? '').trim()
  if (!reason) return res.status(400).json({ error: 'Vui lòng nhập lý do xóa.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, title, requester_id, deleted_at FROM approval_request WHERE id = $1 FOR UPDATE`, [id]
    )
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy đơn.' }) }
    if (rows[0].deleted_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Đơn đã bị xóa trước đó.' }) }

    await client.query(
      `UPDATE approval_request SET deleted_at = now(), deleted_by = $1, deleted_reason = $2, updated_at = now() WHERE id = $3`,
      [req.user.id, reason, id]
    )
    await client.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type, detail) VALUES ($1, $2, 'admin_deleted', $3)`,
      [id, req.user.id, reason]
    )
    await client.query('COMMIT')

    if (rows[0].requester_id) {
      notifyAction([rows[0].requester_id], `Đề xuất "${rows[0].title}" đã bị quản trị xóa.\nLý do: ${reason}`)
    }
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('adminDeleteRequest:', err)
    res.status(500).json({ error: 'Không thể xóa đơn.' })
  } finally {
    client.release()
  }
}

// ── Admin KHÔI PHỤC đơn đã xóa mềm ───────────────────────────────────────────
export async function adminRestoreRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, deleted_at FROM approval_request WHERE id = $1 FOR UPDATE`, [id]
    )
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy đơn.' }) }
    if (!rows[0].deleted_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Đơn chưa bị xóa.' }) }

    await client.query(
      `UPDATE approval_request SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, updated_at = now() WHERE id = $1`,
      [id]
    )
    await client.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type) VALUES ($1, $2, 'admin_restored')`,
      [id, req.user.id]
    )
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('adminRestoreRequest:', err)
    res.status(500).json({ error: 'Không thể khôi phục đơn.' })
  } finally {
    client.release()
  }
}
