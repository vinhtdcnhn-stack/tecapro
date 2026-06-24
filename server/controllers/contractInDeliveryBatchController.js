import { pool } from '../db.js'
import { SHOW_ITEM } from './contractInDeliveryShared.js'
import { verifyUserPassword } from '../auth/verifyPassword.js'

// ── Đợt nhận hàng (delivery batches) ───────────────────────────────────────────

export async function getDeliveries(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        d.*,
        lu.full_name AS locked_by_name,
        COUNT(di.id) FILTER (WHERE ${SHOW_ITEM})::int AS item_count,
        COALESCE(SUM(di.received_quantity), 0)    AS total_received
      FROM contract_in_delivery d
      LEFT JOIN contract_in_delivery_item di ON di.delivery_id = d.id
      LEFT JOIN app_user lu ON lu.id = d.locked_by
      WHERE d.contract_in_id = $1
      GROUP BY d.id, lu.full_name
      ORDER BY d.receive_date DESC, d.id DESC
    `, [req.params.contractInId])
    res.json(rows)
  } catch (err) {
    console.error('getDeliveries:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đợt nhận hàng' })
  }
}

export async function createDelivery(req, res) {
  const { contractInId } = req.params
  const { batch_name, receive_date, warehouse, status, note } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_delivery
        (contract_in_id, batch_name, receive_date, warehouse, status, note)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *, 0 AS item_count, 0 AS total_received
    `, [contractInId, batch_name?.trim()||null, receive_date||null,
        warehouse?.trim()||null, status||'Chờ nhận', note?.trim()||null])
    res.json(rows[0])
  } catch (err) {
    console.error('createDelivery:', err)
    res.status(500).json({ error: 'Không thể tạo đợt nhận hàng' })
  }
}

export async function updateDelivery(req, res) {
  const { id } = req.params
  const { batch_name, receive_date, warehouse, status, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_in_delivery SET
        batch_name=$1, receive_date=$2, warehouse=$3, status=$4, note=$5, updated_at=NOW()
      WHERE id=$6 RETURNING *
    `, [batch_name?.trim()||null, receive_date||null,
        warehouse?.trim()||null, status||'Chờ nhận', note?.trim()||null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đợt nhận' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateDelivery:', err)
    res.status(500).json({ error: 'Không thể cập nhật đợt nhận hàng' })
  }
}

export async function deleteDelivery(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_delivery WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa đợt nhận hàng' })
  }
}

// PATCH /deliveries/:id/lock — khóa/mở khóa đợt nhận (người tạo HĐ + admin, gác bởi ownerVia).
// Khi locked=true mọi thao tác ghi nội dung của đợt bị chặn (blockIfLocked) cho tới khi mở.
export async function setDeliveryLock(req, res) {
  const { id } = req.params
  const locked = !!req.body.locked
  try {
    // Mở khóa là thao tác nhạy cảm → buộc xác thực lại mật khẩu của người thực hiện.
    if (!locked) {
      const ok = await verifyUserPassword(req.user.id, req.body.password)
      if (!ok) return res.status(401).json({ error: 'Mật khẩu không đúng.' })
    }
    const { rows } = await pool.query(`
      WITH upd AS (
        UPDATE contract_in_delivery
          SET locked=$1, locked_by=$2, locked_at=$3, updated_at=NOW()
        WHERE id=$4 RETURNING *
      )
      SELECT upd.*, lu.full_name AS locked_by_name
      FROM upd LEFT JOIN app_user lu ON lu.id = upd.locked_by
    `, [locked, locked ? req.user.id : null, locked ? new Date() : null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đợt nhận' })
    res.json(rows[0])
  } catch (err) {
    console.error('setDeliveryLock:', err)
    res.status(500).json({ error: 'Không thể đổi trạng thái khóa' })
  }
}
