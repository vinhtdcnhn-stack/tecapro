import { pool } from '../db.js'
import { SHOW_ITEM } from './contractInDeliveryShared.js'
import { invalidateContractIn } from '../services/cacheKeys.js'

// Hàng trong đợt đổi → đợt nhận (đếm hàng/SL nhận) + danh mục hàng tổng hợp của HĐ nhập.
async function ciOfDelivery(deliveryId) {
  const { rows } = await pool.query('SELECT contract_in_id FROM contract_in_delivery WHERE id=$1', [deliveryId])
  return rows[0]?.contract_in_id
}
function invalidateItems(ci) {
  invalidateContractIn(ci, 'deliveries', 'all-items', 'all-serials')
}

// ── Hàng hóa trong đợt nhận (delivery items) ───────────────────────────────────

export async function getDeliveryItems(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        di.*,
        COUNT(ds.id) FILTER (WHERE ds.parent_serial_id IS NULL)::int AS serial_count
      FROM contract_in_delivery_item di
      LEFT JOIN contract_in_delivery_serial ds ON ds.delivery_item_id = di.id
      WHERE di.delivery_id = $1
        AND ${SHOW_ITEM}
      GROUP BY di.id
      ORDER BY di.id
    `, [req.params.deliveryId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh mục hàng' })
  }
}

export async function createDeliveryItem(req, res) {
  const { deliveryId } = req.params
  const { boq_item_id, item_name, unit, ordered_quantity, received_quantity, note } = req.body
  if (!item_name?.trim()) return res.status(400).json({ error: 'Tên hàng hóa không được để trống' })
  try {
    // Trong cùng 1 đợt nhận, chủng loại hàng hóa không được trùng (không phân biệt hoa/thường).
    const dup = await pool.query(
      `SELECT 1 FROM contract_in_delivery_item
         WHERE delivery_id=$1 AND lower(btrim(item_name))=lower(btrim($2)) LIMIT 1`,
      [deliveryId, item_name]
    )
    if (dup.rows.length)
      return res.status(409).json({ error: `Chủng loại "${item_name.trim()}" đã có trong đợt nhận này. Mỗi chủng loại chỉ thêm một dòng.` })

    const { rows } = await pool.query(`
      INSERT INTO contract_in_delivery_item
        (delivery_id, boq_item_id, item_name, unit, ordered_quantity, received_quantity, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *, 0 AS serial_count
    `, [deliveryId, boq_item_id||null, item_name.trim(), unit?.trim()||'',
        parseFloat(ordered_quantity)||0, parseFloat(received_quantity)||0, note?.trim()||null])
    invalidateItems(await ciOfDelivery(deliveryId))
    res.json(rows[0])
  } catch (err) {
    console.error('createDeliveryItem:', err)
    res.status(500).json({ error: 'Không thể thêm hàng hóa' })
  }
}

export async function updateDeliveryItem(req, res) {
  const { id } = req.params
  const { item_name, unit, ordered_quantity, received_quantity, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_in_delivery_item SET
        item_name=$1, unit=$2, ordered_quantity=$3, received_quantity=$4, note=$5
      WHERE id=$6 RETURNING *
    `, [item_name?.trim()||'', unit?.trim()||'',
        parseFloat(ordered_quantity)||0, parseFloat(received_quantity)||0,
        note?.trim()||null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    invalidateItems(await ciOfDelivery(rows[0].delivery_id))
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật hàng hóa' })
  }
}

export async function deleteDeliveryItem(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_delivery_item WHERE id=$1 RETURNING delivery_id', [req.params.id])
    if (rows[0]) invalidateItems(await ciOfDelivery(rows[0].delivery_id))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa hàng hóa' })
  }
}
