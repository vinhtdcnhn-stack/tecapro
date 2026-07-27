import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified, invalidateContractIn, invalidateContractInMembers, invalidateReports } from '../services/cacheKeys.js'
import { rejectIfStale } from '../utils/staleGuard.js'

const TAB_TTL = 15 * 60 // 15'

function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

// Phải trả / thanh toán NCC đổi → tab tương ứng + báo cáo công nợ phải trả + dashboard.
function invalidatePayable(contractInId) {
  invalidateContractIn(contractInId, 'payables')
  invalidateReports('debt')
  invalidateContractInMembers(contractInId)
}
function invalidatePay(contractInId) {
  invalidateContractIn(contractInId, 'payments')
  invalidateReports('debt')
  invalidateContractInMembers(contractInId)
}

// ── Payable schedule ──────────────────────────────────────────────────────────

export async function getPayables(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'payables')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'payables'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM contract_in_payable WHERE contract_in_id=$1 ORDER BY id',
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getPayables:', err)
    res.status(500).json({ error: 'Không thể tải lịch phải trả' })
  }
}

export async function createPayable(req, res) {
  const { contractInId } = req.params
  const { description, payment_method, currency_code, amount, exchange_rate, due_date, delay_reason } = req.body
  const vnd = calcVND(amount, exchange_rate, currency_code)
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_payable
        (contract_in_id, description, payment_method, currency_code, amount, exchange_rate, amount_vnd, due_date, delay_reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [contractInId, description||'', payment_method||'TT',
       currency_code||'VND', parseFloat(amount)||0,
       parseFloat(exchange_rate)||1, vnd,
       due_date||null, delay_reason||null]
    )
    invalidatePayable(contractInId)
    res.json(rows[0])
  } catch (err) {
    console.error('createPayable:', err)
    res.status(500).json({ error: 'Không thể thêm khoản phải trả' })
  }
}

export async function updatePayable(req, res) {
  const { id } = req.params
  const { description, payment_method, currency_code, amount, exchange_rate, due_date, delay_reason } = req.body
  const vnd = calcVND(amount, exchange_rate, currency_code)
  try {
    if (await rejectIfStale(req, res, 'contract_in_payable')) return
    const { rows } = await pool.query(`
      UPDATE contract_in_payable SET
        description=$1, payment_method=$2, currency_code=$3,
        amount=$4, exchange_rate=$5, amount_vnd=$6,
        due_date=$7, delay_reason=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *`,
      [description||'', payment_method||'TT', currency_code||'VND',
       parseFloat(amount)||0, parseFloat(exchange_rate)||1, vnd,
       due_date||null, delay_reason||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    invalidatePayable(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updatePayable:', err)
    res.status(500).json({ error: 'Không thể cập nhật khoản phải trả' })
  }
}

export async function deletePayable(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_payable WHERE id=$1 RETURNING contract_in_id', [req.params.id])
    if (rows[0]) invalidatePayable(rows[0].contract_in_id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa' })
  }
}

// ── Actual payments ───────────────────────────────────────────────────────────

export async function getPayments(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'payments')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'payments'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM contract_in_payment WHERE contract_in_id=$1 ORDER BY payment_date, id',
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải lịch thanh toán' })
  }
}

export async function createPayment(req, res) {
  const { contractInId } = req.params
  const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note, payable_id } = req.body
  const vnd = calcVND(amount, exchange_rate, currency_code)
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_payment
        (contract_in_id, payment_date, currency_code, amount, exchange_rate, amount_vnd, payment_ratio, note, payable_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [contractInId, payment_date||null, currency_code||'VND',
       parseFloat(amount)||0, parseFloat(exchange_rate)||1, vnd,
       payment_ratio ? parseFloat(payment_ratio) : null, note||null,
       payable_id ? parseInt(payable_id, 10) : null]
    )
    invalidatePay(contractInId)
    res.json(rows[0])
  } catch (err) {
    console.error('createPayment:', err)
    res.status(500).json({ error: 'Không thể thêm thanh toán' })
  }
}

export async function updatePayment(req, res) {
  const { id } = req.params
  const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note, payable_id } = req.body
  const vnd = calcVND(amount, exchange_rate, currency_code)
  try {
    if (await rejectIfStale(req, res, 'contract_in_payment')) return
    const { rows } = await pool.query(`
      UPDATE contract_in_payment SET
        payment_date=$1, currency_code=$2, amount=$3,
        exchange_rate=$4, amount_vnd=$5, payment_ratio=$6, note=$7,
        payable_id=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *`,
      [payment_date||null, currency_code||'VND',
       parseFloat(amount)||0, parseFloat(exchange_rate)||1, vnd,
       payment_ratio ? parseFloat(payment_ratio) : null, note||null,
       payable_id ? parseInt(payable_id, 10) : null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    invalidatePay(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updatePayment:', err)
    res.status(500).json({ error: 'Không thể cập nhật thanh toán' })
  }
}

export async function deletePayment(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_in_payment WHERE id=$1 RETURNING contract_in_id', [req.params.id])
    if (rows[0]) invalidatePay(rows[0].contract_in_id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa' })
  }
}
