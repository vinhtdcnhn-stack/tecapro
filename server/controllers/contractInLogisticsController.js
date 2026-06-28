import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, invalidateContractIn } from '../services/cacheKeys.js'

const TAB_TTL = 15 * 60 // 15'

async function contractInOfLogistics(logisticsId) {
  const { rows } = await pool.query('SELECT contract_in_id FROM contract_in_logistics WHERE id=$1', [logisticsId])
  return rows[0]?.contract_in_id
}

// ── Logistics records ─────────────────────────────────────────────────────────

export async function getLogisticsList(req, res) {
  try {
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'logistics'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT l.*,
           (SELECT COUNT(*)::int FROM contract_in_logistics_update u WHERE u.logistics_id = l.id) AS update_count,
           (SELECT description FROM contract_in_logistics_update u WHERE u.logistics_id = l.id ORDER BY update_time DESC LIMIT 1) AS last_description,
           (SELECT update_time  FROM contract_in_logistics_update u WHERE u.logistics_id = l.id ORDER BY update_time DESC LIMIT 1) AS last_update_time
         FROM contract_in_logistics l
         WHERE l.contract_in_id = $1
         ORDER BY l.id`,
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getLogisticsList:', err)
    res.status(500).json({ error: 'Không thể tải danh sách logistics' })
  }
}

export async function createLogistics(req, res) {
  const { carrier, tracking_no, has_insurance, insurance_note, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_in_logistics
         (contract_in_id, carrier, tracking_no, has_insurance, insurance_note, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.params.contractInId,
        carrier?.trim()        || null,
        tracking_no?.trim()    || null,
        has_insurance          || false,
        insurance_note?.trim() || null,
        status?.trim()         || 'Chờ vận chuyển',
        note?.trim()           || null,
      ]
    )
    invalidateContractIn(req.params.contractInId, 'logistics')
    res.json({ ...rows[0], update_count: 0, last_description: null, last_update_time: null })
  } catch (err) {
    console.error('createLogistics:', err)
    res.status(500).json({ error: 'Không thể tạo logistics' })
  }
}

export async function updateLogistics(req, res) {
  const { carrier, tracking_no, has_insurance, insurance_note, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE contract_in_logistics SET
         carrier=$1, tracking_no=$2, has_insurance=$3,
         insurance_note=$4, status=$5, note=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        carrier?.trim()        || null,
        tracking_no?.trim()    || null,
        has_insurance          || false,
        insurance_note?.trim() || null,
        status?.trim()         || 'Chờ vận chuyển',
        note?.trim()           || null,
        req.params.id,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' })
    invalidateContractIn(rows[0].contract_in_id, 'logistics')
    res.json(rows[0])
  } catch (err) {
    console.error('updateLogistics:', err)
    res.status(500).json({ error: 'Không thể cập nhật logistics' })
  }
}

export async function deleteLogistics(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_logistics WHERE id=$1 RETURNING contract_in_id', [req.params.id])
    if (rows[0]) invalidateContractIn(rows[0].contract_in_id, 'logistics')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa logistics' })
  }
}

// ── Logistics updates (timeline) ──────────────────────────────────────────────

export async function getLogisticsUpdates(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM contract_in_logistics_update WHERE logistics_id=$1 ORDER BY update_time DESC, id DESC',
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải lịch sử' })
  }
}

export async function createLogisticsUpdate(req, res) {
  const { description, location, update_time } = req.body
  if (!description?.trim()) return res.status(400).json({ error: 'Mô tả là bắt buộc' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_in_logistics_update (logistics_id, description, location, update_time)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, description.trim(), location?.trim() || null, update_time || new Date().toISOString()]
    )
    invalidateContractIn(await contractInOfLogistics(req.params.id), 'logistics')
    res.json(rows[0])
  } catch (err) {
    console.error('createLogisticsUpdate:', err)
    res.status(500).json({ error: 'Không thể thêm cập nhật' })
  }
}

export async function deleteLogisticsUpdate(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_logistics_update WHERE id=$1 RETURNING logistics_id', [req.params.id])
    if (rows[0]) invalidateContractIn(await contractInOfLogistics(rows[0].logistics_id), 'logistics')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa' })
  }
}
