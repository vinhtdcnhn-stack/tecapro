import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified, invalidateContract } from '../services/cacheKeys.js'
import { computeCoverage } from './supplyCoverageHelpers.js'

const TAB_TTL = 15 * 60 // 15'

// Độ phủ đổi → vô hiệu cả tab theo dõi ('supply-coverage') lẫn tab bảng giá ('boq',
// vì chấm màu + cờ no_import_needed đọc từ đó).
function invalidateCoverage(contractOutId) {
  invalidateContract(contractOutId, 'supply-coverage', 'boq')
}

// GET /contracts/:contractId/supply-coverage — chi tiết theo dõi nhập hàng
export async function getSupplyCoverage(req, res) {
  const contractId = parseInt(req.params.contractId)
  try {
    if (await contractTabNotModified(req, res, contractId, 'supply-coverage')) return
    const data = await cacheWrap(
      contractKey(contractId, 'supply-coverage'), TAB_TTL,
      () => computeCoverage(contractId))
    res.json(data)
  } catch (err) {
    console.error('getSupplyCoverage:', err)
    res.status(500).json({ error: 'Không thể tải theo dõi nhập hàng' })
  }
}

// GET /contracts/:contractId/supply-coverage/summary — { [boqId]: status } cho chấm màu.
// Chỉ chứa các leaf CẦN NHẬP (computeCoverage đã loại no_import_needed) → FE: boqId không
// có trong map = không hiện chấm.
export async function getCoverageSummary(req, res) {
  const contractId = parseInt(req.params.contractId)
  try {
    if (await contractTabNotModified(req, res, contractId, 'supply-coverage')) return
    const data = await cacheWrap(
      contractKey(contractId, 'supply-coverage'), TAB_TTL,
      () => computeCoverage(contractId))
    const map = {}
    for (const leaf of data.leaves) map[leaf.boq_id] = leaf.status
    res.json(map)
  } catch (err) {
    console.error('getCoverageSummary:', err)
    res.status(500).json({ error: 'Không thể tải trạng thái nhập' })
  }
}

// PUT /boq/:id/no-import-needed  { value: bool } — PM đánh dấu dòng (không) cần nhập.
export async function setNoImportNeeded(req, res) {
  const id = parseInt(req.params.id)
  const value = !!req.body?.value
  try {
    const { rows } = await pool.query(
      `UPDATE contract_out_boq SET no_import_needed = $1, updated_at = now()
        WHERE id = $2 RETURNING contract_out_id`, [value, id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy dòng bảng giá' })
    invalidateCoverage(rows[0].contract_out_id)
    res.json({ id, no_import_needed: value })
  } catch (err) {
    console.error('setNoImportNeeded:', err)
    res.status(500).json({ error: 'Không thể cập nhật cờ nhập' })
  }
}

// POST /contracts/:contractId/supply-slots  { boq_id, name, needed_qty, unit, note }
export async function createSlot(req, res) {
  const contractId = parseInt(req.params.contractId)
  const { boq_id, name, needed_qty, unit, note } = req.body || {}
  try {
    const { rows: chk } = await pool.query(
      `SELECT id FROM contract_out_boq WHERE id = $1 AND contract_out_id = $2`,
      [boq_id, contractId])
    if (!chk.length) return res.status(400).json({ error: 'Dòng bảng giá không hợp lệ' })
    const { rows: mx } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM contract_out_supply_slot WHERE boq_id = $1`,
      [boq_id])
    const { rows } = await pool.query(
      `INSERT INTO contract_out_supply_slot (boq_id, name, needed_qty, unit, sort_order, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [boq_id, name || '', parseFloat(needed_qty) || 0, unit || '', Number(mx[0].m) + 1, note || null])
    invalidateCoverage(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createSlot:', err)
    res.status(500).json({ error: 'Không thể thêm đầu bán' })
  }
}

// PUT /supply-slots/:id  { name, needed_qty, unit, note }
export async function updateSlot(req, res) {
  const id = parseInt(req.params.id)
  const { name, needed_qty, unit, note } = req.body || {}
  try {
    const { rows } = await pool.query(
      `UPDATE contract_out_supply_slot SET
         name=$1, needed_qty=$2, unit=$3, note=$4, updated_at=now()
       WHERE id=$5
       RETURNING id, (SELECT contract_out_id FROM contract_out_boq WHERE id = boq_id) AS contract_out_id`,
      [name || '', parseFloat(needed_qty) || 0, unit || '', note || null, id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu bán' })
    invalidateCoverage(rows[0].contract_out_id)
    res.json({ id })
  } catch (err) {
    console.error('updateSlot:', err)
    res.status(500).json({ error: 'Không thể cập nhật đầu bán' })
  }
}

// DELETE /supply-slots/:id — link trỏ vào đầu này tự CASCADE.
export async function deleteSlot(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `DELETE FROM contract_out_supply_slot WHERE id = $1
       RETURNING (SELECT contract_out_id FROM contract_out_boq WHERE id = boq_id) AS contract_out_id`,
      [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu bán' })
    invalidateCoverage(rows[0].contract_out_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteSlot:', err)
    res.status(500).json({ error: 'Không thể xóa đầu bán' })
  }
}

// POST /contracts/:contractId/supply-slots/reorder  { ids: [...] } — sắp xếp trong 1 leaf.
export async function reorderSlots(req, res) {
  const contractId = parseInt(req.params.contractId)
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        'UPDATE contract_out_supply_slot SET sort_order = $1 WHERE id = $2', [i + 1, ids[i]])
    }
    await client.query('COMMIT')
    invalidateCoverage(contractId)
    res.json({ message: 'Reordered', count: ids.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('reorderSlots:', err)
    res.status(500).json({ error: 'Không thể đổi thứ tự đầu bán' })
  } finally {
    client.release()
  }
}
