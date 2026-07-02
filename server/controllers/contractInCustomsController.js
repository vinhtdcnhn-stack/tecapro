import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified, invalidateContractIn, invalidateContractInMembers } from '../services/cacheKeys.js'

const TAB_TTL = 30 * 60 // 30'

function invalidateCustoms(contractInId) {
  invalidateContractIn(contractInId, 'customs')
  invalidateContractInMembers(contractInId)
}

const FIELDS = [
  'shipment_type', 'declaration_no', 'declaration_date', 'bl_awb_no',
  'etd', 'eta', 'port_of_loading', 'port_of_discharge',
  'customs_status', 'shipping_cost', 'tax_amount', 'other_fees', 'note',
]

function bodyToValues(body) {
  return [
    body.shipment_type?.trim()     || 'Nhập khẩu',
    body.declaration_no?.trim()    || null,
    body.declaration_date          || null,
    body.bl_awb_no?.trim()         || null,
    body.etd                       || null,
    body.eta                       || null,
    body.port_of_loading?.trim()   || null,
    body.port_of_discharge?.trim() || null,
    body.customs_status?.trim()    || 'Chưa khai báo',
    parseFloat(body.shipping_cost) || 0,
    parseFloat(body.tax_amount)    || 0,
    parseFloat(body.other_fees)    || 0,
    body.note?.trim()              || null,
  ]
}

export async function getContractInCustoms(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'customs')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'customs'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM contract_in_customs WHERE contract_in_id=$1 ORDER BY id',
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getContractInCustoms:', err)
    res.status(500).json({ error: 'Không thể tải danh sách lô hàng' })
  }
}

export async function createContractInCustoms(req, res) {
  const vals = bodyToValues(req.body)
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_in_customs
        (contract_in_id, ${FIELDS.join(', ')})
       VALUES ($1,${FIELDS.map((_,i)=>`$${i+2}`).join(',')}) RETURNING *`,
      [req.params.contractInId, ...vals]
    )
    invalidateCustoms(req.params.contractInId)
    res.json(rows[0])
  } catch (err) {
    console.error('createContractInCustoms:', err)
    res.status(500).json({ error: 'Không thể tạo lô hàng' })
  }
}

export async function updateContractInCustoms(req, res) {
  const vals = bodyToValues(req.body)
  try {
    const sets = FIELDS.map((f, i) => `${f}=$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `UPDATE contract_in_customs SET ${sets}, updated_at=NOW()
       WHERE id=$${FIELDS.length + 1} RETURNING *`,
      [...vals, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy lô hàng' })
    invalidateCustoms(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateContractInCustoms:', err)
    res.status(500).json({ error: 'Không thể cập nhật lô hàng' })
  }
}

export async function deleteContractInCustoms(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_customs WHERE id=$1 RETURNING contract_in_id', [req.params.id])
    if (rows[0]) invalidateCustoms(rows[0].contract_in_id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteContractInCustoms:', err)
    res.status(500).json({ error: 'Không thể xóa lô hàng' })
  }
}
