import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified } from '../services/cacheKeys.js'
import { rejectIfStale } from '../utils/staleGuard.js'
import { clampMonths, bbIdOrNull } from '../utils/warrantyMonths.js'
import {
  calc, getContractInCurrency, findDuplicateName, dupNameError,
  syncContractInTotal, invalidateBOQIn, warrantyFields, validateWarrantyBBIn,
} from './contractInBOQHelpers.js'

const TAB_TTL = 15 * 60 // 15'

// Nhập/xuất Excel ở contractInBOQExcel.js; helper dùng chung ở contractInBOQHelpers.js.

// GET /contract-ins/:contractInId/boq
export async function getPurchaseBOQ(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'boq')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'boq'), TAB_TTL, async () => {
      // Kèm TẤT CẢ ghép "Nhập cho" hiện tại (1 dòng nhập có thể gắn nhiều đầu bán) dưới dạng
      // mảng JSON `links` để cột hiển thị sẵn danh sách.
      // contract_out_id kèm mỗi link để FE lọc "Nhập cho" theo HĐ bán đang xem (context-scoped):
      // 1 dòng nhập có thể nhập cho hàng bán của nhiều HĐ bán khác nhau.
      const { rows } = await pool.query(
        `SELECT b.*,
                COALESCE(l.links, '[]'::json) AS links
           FROM contract_in_boq b
           LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                      'id', sl.id, 'boq_id', sl.boq_id, 'slot_id', sl.slot_id,
                      'covered_qty', sl.covered_qty, 'contract_out_id', ob.contract_out_id
                    ) ORDER BY sl.id) AS links
               FROM contract_in_boq_supply_link sl
               JOIN contract_out_boq ob ON ob.id = sl.boq_id
              WHERE sl.contract_in_boq_id = b.id
           ) l ON true
          WHERE b.contract_in_id = $1 ORDER BY b.sort_order, b.id`,
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getPurchaseBOQ:', err)
    res.status(500).json({ error: 'Không thể tải bảng giá mua' })
  }
}

// PATCH /contract-ins/:contractInId/boq-warranty-default
// Mốc bảo hành MẶC ĐỊNH của cả bảng giá mua: { warranty_bb_id, warranty_months }.
// Dòng nào không tự điền mốc/số tháng thì hiển thị theo mặc định này (chỉ là giá trị
// dùng chung — KHÔNG ghi đè dữ liệu đã điền riêng ở từng dòng).
export async function setPurchaseBOQWarrantyDefault(req, res) {
  const { contractInId } = req.params
  try {
    const bbId   = bbIdOrNull(req.body.warranty_bb_id)
    const months = clampMonths(req.body.warranty_months)
    const bbErr  = await validateWarrantyBBIn(contractInId, bbId)
    if (bbErr) return res.status(400).json({ error: bbErr })

    const { rows } = await pool.query(
      `UPDATE contract_in SET boq_warranty_bb_id = $1, boq_warranty_months = $2, updated_at = NOW()
        WHERE id = $3 RETURNING id, boq_warranty_bb_id, boq_warranty_months`,
      [bbId, months, contractInId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy hợp đồng nhập.' })
    invalidateBOQIn(contractInId)
    res.json(rows[0])
  } catch (err) {
    console.error('setPurchaseBOQWarrantyDefault:', err)
    res.status(500).json({ error: 'Không thể lưu mốc bảo hành mặc định.' })
  }
}

// POST /contract-ins/:contractInId/boq
export async function createPurchaseBOQItem(req, res) {
  try {
    const { contractInId } = req.params
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    if (await findDuplicateName(contractInId, item_name)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const wty   = warrantyFields(req.body)
    const bbErr = await validateWarrantyBBIn(contractInId, wty.warranty_bb_id)
    if (bbErr) return res.status(400).json({ error: bbErr })

    const currency = await getContractInCurrency(contractInId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM contract_in_boq WHERE contract_in_id = $1',
      [contractInId]
    )
    const sortOrder = Number(mx[0].m) + 1
    const { rows } = await pool.query(`
      INSERT INTO contract_in_boq
        (contract_in_id, sort_order, item_name, unit, quantity, unit_price,
         amount_before_vat, vat_rate, amount_after_vat, warranty_period,
         warranty_bb_id, warranty_months)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [contractInId, sortOrder, item_name||'', unit||'',
       parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'',
       wty.warranty_bb_id, wty.warranty_months]
    )
    await syncContractInTotal(contractInId)
    invalidateBOQIn(contractInId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createPurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể thêm dòng bảng giá' })
  }
}

// POST /contract-ins/:contractInId/boq/after/:refId
export async function insertPurchaseBOQAfter(req, res) {
  try {
    const { contractInId, refId } = req.params
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    if (await findDuplicateName(contractInId, item_name)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const wty   = warrantyFields(req.body)
    const bbErr = await validateWarrantyBBIn(contractInId, wty.warranty_bb_id)
    if (bbErr) return res.status(400).json({ error: bbErr })

    const { rows: ref } = await pool.query(
      'SELECT sort_order FROM contract_in_boq WHERE id = $1 AND contract_in_id = $2',
      [refId, contractInId]
    )
    if (!ref.length) return res.status(404).json({ error: 'Reference row not found' })
    const refSort = Number(ref[0].sort_order)
    await pool.query(
      'UPDATE contract_in_boq SET sort_order = sort_order + 1 WHERE contract_in_id = $1 AND sort_order > $2',
      [contractInId, refSort]
    )
    const currency = await getContractInCurrency(contractInId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows } = await pool.query(`
      INSERT INTO contract_in_boq
        (contract_in_id, sort_order, item_name, unit, quantity, unit_price,
         amount_before_vat, vat_rate, amount_after_vat, warranty_period,
         warranty_bb_id, warranty_months)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [contractInId, refSort+1, item_name||'', unit||'',
       parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'',
       wty.warranty_bb_id, wty.warranty_months]
    )
    await syncContractInTotal(contractInId)
    invalidateBOQIn(contractInId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('insertPurchaseBOQAfter:', err)
    res.status(500).json({ error: 'Không thể chèn dòng' })
  }
}

// PUT /purchase-boq/:id
export async function updatePurchaseBOQItem(req, res) {
  try {
    if (await rejectIfStale(req, res, 'contract_in_boq')) return
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    const { rows: cur } = await pool.query(
      `SELECT c.currency_code, b.contract_in_id FROM contract_in_boq b
       JOIN contract_in c ON c.id = b.contract_in_id
       WHERE b.id = $1`, [req.params.id]
    )
    if (!cur.length) return res.status(404).json({ error: 'Not found' })
    if (await findDuplicateName(cur[0].contract_in_id, item_name, req.params.id)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const wty   = warrantyFields(req.body)
    const bbErr = await validateWarrantyBBIn(cur[0].contract_in_id, wty.warranty_bb_id)
    if (bbErr) return res.status(400).json({ error: bbErr })

    const currency = cur[0]?.currency_code || 'VND'
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows } = await pool.query(`
      UPDATE contract_in_boq SET
        item_name=$1, unit=$2, quantity=$3, unit_price=$4,
        amount_before_vat=$5, vat_rate=$6, amount_after_vat=$7,
        warranty_period=$8, warranty_bb_id=$9, warranty_months=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *`,
      [item_name||'', unit||'', parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'',
       wty.warranty_bb_id, wty.warranty_months, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractInTotal(rows[0].contract_in_id)
    invalidateBOQIn(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updatePurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể cập nhật dòng' })
  }
}

// DELETE /purchase-boq/:id
export async function deletePurchaseBOQItem(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM contract_in_boq WHERE id = $1 RETURNING contract_in_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractInTotal(rows[0].contract_in_id)
    invalidateBOQIn(rows[0].contract_in_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deletePurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể xóa dòng' })
  }
}

// POST /contract-ins/:contractInId/boq/reorder  { ids: [...] } — đổi thứ tự dòng
export async function reorderPurchaseBOQ(req, res) {
  const { contractInId } = req.params
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        'UPDATE contract_in_boq SET sort_order = $1 WHERE id = $2 AND contract_in_id = $3',
        [i + 1, ids[i], contractInId]
      )
    }
    await client.query('COMMIT')
    invalidateBOQIn(contractInId)
    res.json({ message: 'Reordered', count: ids.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('reorderPurchaseBOQ:', err)
    res.status(500).json({ error: 'Không thể đổi thứ tự dòng' })
  } finally {
    client.release()
  }
}

// POST /purchase-boq/bulk-delete  { ids: [...] } — xóa nhiều dòng trong 1 transaction
export async function bulkDeletePurchaseBOQItems(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'DELETE FROM contract_in_boq WHERE id = ANY($1::bigint[]) RETURNING contract_in_id',
      [ids]
    )
    const contractInIds = [...new Set(rows.map(r => r.contract_in_id))]
    for (const cid of contractInIds) await syncContractInTotal(cid, client)
    await client.query('COMMIT')
    for (const cid of contractInIds) invalidateBOQIn(cid)
    res.json({ message: 'Deleted', count: rows.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('bulkDeletePurchaseBOQItems:', err)
    res.status(500).json({ error: 'Không thể xóa các dòng đã chọn' })
  } finally {
    client.release()
  }
}
