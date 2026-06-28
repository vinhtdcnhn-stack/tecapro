import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractKey, invalidateContract, invalidateContractMembers } from '../services/cacheKeys.js'

const TAB_TTL = 60 * 60 // 60' — bảo lãnh đổi rất ít

// Bảo lãnh đổi → tab guarantees + dashboard thành viên (dashboard có cảnh báo hạn bảo lãnh).
function invalidateGuarantee(contractId) {
  invalidateContract(contractId, 'guarantees')
  invalidateContractMembers(contractId)
}

export async function getGuarantees(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const rows = await cacheWrap(contractKey(contractId, 'guarantees'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT * FROM contract_guarantee WHERE contract_out_id = $1 ORDER BY id`,
        [contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getGuarantees:', err)
    res.status(500).json({ error: 'Không thể tải danh sách bảo lãnh' })
  }
}

export async function createGuarantee(req, res) {
  const contractId = parseInt(req.params.id)
  const { guarantee_type, amount, issue_date, expiry_date, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_guarantee
        (contract_out_id, guarantee_type, amount, issue_date, expiry_date, status, note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
      [
        contractId,
        guarantee_type?.trim() || null,
        parseFloat(amount) || 0,
        issue_date || null,
        expiry_date || null,
        status || 'Còn hiệu lực',
        note?.trim() || null,
      ]
    )
    invalidateGuarantee(contractId)
    res.json(rows[0])
  } catch (err) {
    console.error('createGuarantee:', err)
    res.status(500).json({ error: 'Không thể tạo bảo lãnh' })
  }
}

export async function updateGuarantee(req, res) {
  const id = parseInt(req.params.id)
  const { guarantee_type, amount, issue_date, expiry_date, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE contract_guarantee SET
        guarantee_type = $1,
        amount         = $2,
        issue_date     = $3,
        expiry_date    = $4,
        status         = $5,
        note           = $6,
        updated_at     = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        guarantee_type?.trim() || null,
        parseFloat(amount) || 0,
        issue_date || null,
        expiry_date || null,
        status || 'Còn hiệu lực',
        note?.trim() || null,
        id,
      ]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bảo lãnh' })
    invalidateGuarantee(rows[0].contract_out_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateGuarantee:', err)
    res.status(500).json({ error: 'Không thể cập nhật bảo lãnh' })
  }
}

export async function deleteGuarantee(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query('DELETE FROM contract_guarantee WHERE id = $1 RETURNING contract_out_id', [id])
    if (rows[0]) invalidateGuarantee(rows[0].contract_out_id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteGuarantee:', err)
    res.status(500).json({ error: 'Không thể xóa bảo lãnh' })
  }
}
