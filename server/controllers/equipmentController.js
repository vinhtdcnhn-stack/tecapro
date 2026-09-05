import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified } from '../services/cacheKeys.js'
import { clampMonths, bbIdOrNull } from '../utils/warrantyMonths.js'
import { TAB_TTL, invalidateEquip } from './warrantyShared.js'
import { invalidateBOQ } from './boqController.js'
import {
  effectiveBOQWarranty, syncEquipmentFromBOQ, boqWriteBlockReason, writeWarrantyToBOQ,
} from '../services/equipmentWarrantySync.js'

// THIẾT BỊ BÀN GIAO (tab Bảo hành). Tách khỏi warrantyController.js để giữ file < 500 dòng.
//
// Thiết bị GẮN với 1 dòng bảng giá (boq_id) thì bảng giá là nguồn duy nhất:
//   tên hàng + mốc bảo hành (biên bản, số tháng) lấy từ dòng đó, sửa mốc ở màn hình này
//   sẽ GHI NGƯỢC vào chính dòng bảng giá (cần quyền co.boq.manage + bảng giá chưa khóa).
// Thiết bị không gắn: giữ cách cũ — tự nhập tên và mốc bảo hành.

const SELECT_ONE = `
  SELECT e.*, b.item_name AS boq_item_name,
         COALESCE(
           json_agg(s ORDER BY s.serial_no) FILTER (WHERE s.id IS NOT NULL), '[]'
         ) AS serials
    FROM contract_equipment e
    LEFT JOIN contract_out_boq b ON b.id = e.boq_id
    LEFT JOIN equipment_serial s ON s.equipment_id = e.id
   WHERE e.id = $1
   GROUP BY e.id, b.item_name`

async function readOne(id) {
  const { rows } = await pool.query(SELECT_ONE, [id])
  return rows[0]
}

// Chuẩn bị phần "gắn bảng giá" của payload.
// Trả { error } nếu không hợp lệ/không đủ quyền; { boqId: null } nếu không gắn;
// { boqId, name, changed, bbId, months } nếu có gắn (changed = mốc BH khác bảng giá ⇒ phải ghi ngược).
async function prepareBoqLink(user, contractId, body) {
  const boqId = bbIdOrNull(body.boq_id)
  if (boqId == null) return { boqId: null }

  const row = await effectiveBOQWarranty(contractId, boqId)
  if (!row) return { error: 'Dòng bảng giá không thuộc hợp đồng này.', status: 400 }
  if (row.row_kind !== 'leaf') return { error: 'Chỉ gắn được với DÒNG HÀNG (dòng lá) của bảng giá.', status: 400 }

  const bbId   = bbIdOrNull(body.warranty_bb_id)
  const months = clampMonths(body.warranty_months)
  // So với mốc HIỆU LỰC đang hiển thị (đã áp mặc định cấp HĐ) — chỉ khi người dùng
  // thực sự đổi thì mới cần quyền sửa bảng giá.
  const changed = bbId !== (row.bb_id ?? null) || months !== (row.months ?? null)
  if (changed) {
    const reason = await boqWriteBlockReason(user, contractId)
    if (reason) return { error: reason }
  }
  return { boqId, name: row.item_name, changed, bbId, months }
}

// Sau khi lưu thiết bị có gắn bảng giá: ghi ngược mốc BH (nếu đổi) rồi kéo lại
// tên + ngày BH từ bảng giá cho mọi thiết bị của hợp đồng.
async function applyBoqLink(contractId, link) {
  if (link.boqId == null) return
  if (link.changed) {
    await writeWarrantyToBOQ(link.boqId, { bbId: link.bbId, months: link.months })
    invalidateBOQ(contractId)
  }
  await syncEquipmentFromBOQ(contractId)
}

export async function getEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    if (await contractTabNotModified(req, res, contractId, 'equipment')) return
    const rows = await cacheWrap(contractKey(contractId, 'equipment'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT
           e.*,
           b.item_name AS boq_item_name,
           COALESCE(
             json_agg(s ORDER BY s.serial_no) FILTER (WHERE s.id IS NOT NULL),
             '[]'
           ) AS serials
         FROM contract_equipment e
         LEFT JOIN contract_out_boq b ON b.id = e.boq_id
         LEFT JOIN equipment_serial s ON s.equipment_id = e.id
         WHERE e.contract_out_id = $1
         GROUP BY e.id, b.item_name
         ORDER BY e.name, e.brand`,
        [contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getEquipment:', err)
    res.status(500).json({ error: 'Không thể tải danh sách thiết bị' })
  }
}

// Chuẩn hóa số nguyên tùy chọn (id biên bản, số tháng, id đợt giao) → int | null.
const intOrNull = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export async function createEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months, delivery_id } = req.body
  try {
    const link = await prepareBoqLink(req.user, contractId, req.body)
    if (link.error) return res.status(link.status || 403).json({ error: link.error })

    // Gắn bảng giá ⇒ tên lấy theo dòng bảng giá (đồng bộ), không nhận tên client gửi.
    const finalName = link.boqId != null ? link.name : String(name ?? '').trim()
    if (!finalName) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })

    const { rows } = await pool.query(
      `INSERT INTO contract_equipment
         (contract_out_id, name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months, delivery_id, boq_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, contract_out_id`,
      [contractId, finalName, brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null,
       intOrNull(warranty_bb_id), intOrNull(warranty_months), intOrNull(delivery_id), link.boqId]
    )
    await applyBoqLink(contractId, link)
    invalidateEquip(contractId)
    res.json({ ...(await readOne(rows[0].id)), serials: [] })
  } catch (err) {
    console.error('createEquipment:', err)
    res.status(500).json({ error: 'Không thể thêm thiết bị' })
  }
}

export async function updateEquipment(req, res) {
  const id = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months } = req.body
  try {
    const { rows: cur } = await pool.query(
      'SELECT contract_out_id FROM contract_equipment WHERE id=$1', [id])
    if (!cur[0]) return res.status(404).json({ error: 'Không tìm thấy thiết bị' })
    const contractId = cur[0].contract_out_id

    const link = await prepareBoqLink(req.user, contractId, req.body)
    if (link.error) return res.status(link.status || 403).json({ error: link.error })

    const finalName = link.boqId != null ? link.name : String(name ?? '').trim()
    if (!finalName) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })

    await pool.query(
      `UPDATE contract_equipment SET
         name=$1, brand=$2, model=$3, quantity=$4, location=$5,
         warranty_from=$6, warranty_to=$7, has_serial=$8, note=$9,
         warranty_bb_id=$10, warranty_months=$11, boq_id=$12, updated_at=NOW()
       WHERE id=$13`,
      [finalName, brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null,
       intOrNull(warranty_bb_id), intOrNull(warranty_months), link.boqId, id]
    )
    await applyBoqLink(contractId, link)
    invalidateEquip(contractId)
    res.json(await readOne(id))
  } catch (err) {
    console.error('updateEquipment:', err)
    res.status(500).json({ error: 'Không thể cập nhật thiết bị' })
  }
}

export async function deleteEquipment(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query('DELETE FROM contract_equipment WHERE id=$1 RETURNING contract_out_id', [id])
    if (rows[0]) invalidateEquip(rows[0].contract_out_id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteEquipment:', err)
    res.status(500).json({ error: 'Không thể xóa thiết bị' })
  }
}
