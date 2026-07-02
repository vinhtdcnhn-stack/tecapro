import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified, invalidateContract } from '../services/cacheKeys.js'

const TAB_TTL = 30 * 60 // 30'

// Đợt giao hàng của HĐ bán (tab "Thiết bị bàn giao"). Tương tự đợt nhận hàng của HĐ nhập,
// nhưng chỉ giữ 3 trường: batch_name, delivery_date, note.

// Thiết bị CHA hiển thị ở đợt: có ít nhất 1 serial độc lập (máy) HOẶC chưa có serial nào.
// Thiết bị linh-kiện (mọi serial đều có parent_serial_id) không tính vào số thiết bị của đợt.
const PARENT_EQUIPMENT = `(
  EXISTS (SELECT 1 FROM equipment_serial s WHERE s.equipment_id = e.id AND s.parent_serial_id IS NULL)
  OR NOT EXISTS (SELECT 1 FROM equipment_serial s WHERE s.equipment_id = e.id)
)`

export async function getDeliveries(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.id, 'deliveries')) return
    const rows = await cacheWrap(contractKey(req.params.id, 'deliveries'), TAB_TTL, async () => {
      const { rows } = await pool.query(`
        SELECT
          d.*,
          COUNT(e.id) FILTER (WHERE ${PARENT_EQUIPMENT})::int AS equipment_count
        FROM contract_out_delivery d
        LEFT JOIN contract_equipment e ON e.delivery_id = d.id
        WHERE d.contract_out_id = $1
        GROUP BY d.id
        ORDER BY d.delivery_date DESC NULLS LAST, d.id DESC
      `, [req.params.id])
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getDeliveries (out):', err)
    res.status(500).json({ error: 'Không thể tải danh sách đợt giao hàng' })
  }
}

export async function createDelivery(req, res) {
  const contractId = parseInt(req.params.id)
  const { batch_name, delivery_date, note } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_out_delivery (contract_out_id, batch_name, delivery_date, note)
      VALUES ($1,$2,$3,$4)
      RETURNING *, 0 AS equipment_count
    `, [contractId, batch_name?.trim()||null, delivery_date||null, note?.trim()||null])
    invalidateContract(contractId, 'deliveries')
    res.json(rows[0])
  } catch (err) {
    console.error('createDelivery (out):', err)
    res.status(500).json({ error: 'Không thể tạo đợt giao hàng' })
  }
}

export async function updateDelivery(req, res) {
  const { id } = req.params
  const { batch_name, delivery_date, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_out_delivery SET
        batch_name=$1, delivery_date=$2, note=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [batch_name?.trim()||null, delivery_date||null, note?.trim()||null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đợt giao hàng' })
    invalidateContract(rows[0].contract_out_id, 'deliveries')
    res.json(rows[0])
  } catch (err) {
    console.error('updateDelivery (out):', err)
    res.status(500).json({ error: 'Không thể cập nhật đợt giao hàng' })
  }
}

export async function deleteDelivery(req, res) {
  try {
    // CASCADE: xóa đợt → xóa thiết bị của đợt → xóa serial.
    const { rows } = await pool.query('DELETE FROM contract_out_delivery WHERE id=$1 RETURNING contract_out_id', [req.params.id])
    if (rows[0]) invalidateContract(rows[0].contract_out_id, 'deliveries', 'equipment')
    res.json({ success: true })
  } catch (err) {
    console.error('deleteDelivery (out):', err)
    res.status(500).json({ error: 'Không thể xóa đợt giao hàng' })
  }
}
