import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified, invalidateContractIn, invalidateContractInMembers } from '../services/cacheKeys.js'

const TAB_TTL = 30 * 60 // 30'

// Bảo lãnh HĐ nhập đổi → tab guarantees + dashboard thành viên HĐ bán cha (cảnh báo hạn BL).
function invalidateGuaranteeIn(contractInId) {
  invalidateContractIn(contractInId, 'guarantees')
  invalidateContractInMembers(contractInId)
}

export async function getContractInGuarantees(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'guarantees')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'guarantees'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM contract_in_guarantee WHERE contract_in_id = $1 ORDER BY id',
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getContractInGuarantees:', err)
    res.status(500).json({ error: 'Không thể tải danh sách bảo lãnh' })
  }
}

export async function createContractInGuarantee(req, res) {
  const { contractInId } = req.params
  const { guarantee_type, amount, issue_date, expiry_date, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_in_guarantee
        (contract_in_id, guarantee_type, amount, issue_date, expiry_date, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        contractInId,
        guarantee_type?.trim() || 'Bảo lãnh thanh toán',
        parseFloat(amount) || 0,
        issue_date || null,
        expiry_date || null,
        status || 'Còn hiệu lực',
        note?.trim() || null,
      ]
    )
    invalidateGuaranteeIn(contractInId)
    res.json(rows[0])
  } catch (err) {
    console.error('createContractInGuarantee:', err)
    res.status(500).json({ error: 'Không thể tạo bảo lãnh' })
  }
}

export async function updateContractInGuarantee(req, res) {
  const { guarantee_type, amount, issue_date, expiry_date, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE contract_in_guarantee SET
        guarantee_type=$1, amount=$2, issue_date=$3,
        expiry_date=$4, status=$5, note=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        guarantee_type?.trim() || 'Bảo lãnh thanh toán',
        parseFloat(amount) || 0,
        issue_date || null,
        expiry_date || null,
        status || 'Còn hiệu lực',
        note?.trim() || null,
        req.params.id,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy bảo lãnh' })
    invalidateGuaranteeIn(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateContractInGuarantee:', err)
    res.status(500).json({ error: 'Không thể cập nhật bảo lãnh' })
  }
}

export async function deleteContractInGuarantee(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_guarantee WHERE id=$1 RETURNING contract_in_id', [req.params.id])
    if (rows[0]) invalidateGuaranteeIn(rows[0].contract_in_id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteContractInGuarantee:', err)
    res.status(500).json({ error: 'Không thể xóa bảo lãnh' })
  }
}
