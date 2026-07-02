import { pool } from '../db.js'
import { notifyInfo, pmUserIds, contractLabel, fmtDate } from '../services/notify.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified, invalidateContract, invalidateContractMembers, invalidateReports } from '../services/cacheKeys.js'

const TAB_TTL = 30 * 60 // 30'

// Lịch phải thu đổi (có thể kèm đồng bộ tỷ giá toàn HĐ) → tab receivable + payments + info
// + dashboard thành viên + báo cáo công nợ.
function invalidateScheduleTabs(contractId) {
  invalidateContract(contractId, 'receivable', 'receivable-payments', 'info')
  invalidateContractMembers(contractId)
  invalidateReports('debt')
}
// Tiền về đổi → tab payments + dashboard + báo cáo công nợ.
function invalidatePaymentTabs(contractId) {
  invalidateContract(contractId, 'receivable-payments')
  invalidateContractMembers(contractId)
  invalidateReports('debt')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

// Tỷ giá dùng chung cho cả hợp đồng: đồng bộ tỷ giá của một bản ghi → hợp đồng
// và lan tỏa cho TẤT CẢ khoản phải thu ngoại tệ của hợp đồng (chỉ khi tỷ giá hợp lệ).
async function syncContractRate(contractId, currency, rate, db = pool) {
  const r = parseFloat(rate)
  if (!contractId || currency === 'VND' || !(r > 0)) return
  await db.query(
    'UPDATE public.contract_out SET exchange_rate = $1, updated_at = now() WHERE id = $2',
    [r, contractId]
  )
  await db.query(
    `UPDATE public.contract_receivable
        SET exchange_rate = $1, amount_vnd = amount * $1, updated_at = now()
      WHERE contract_out_id = $2 AND currency_code <> 'VND'`,
    [r, contractId]
  )
}

// ── Receivable Schedule (Phải thu theo ĐKTT HĐ) ───────────────────────────────

export async function getSchedule(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.contractId, 'receivable')) return
    const rows = await cacheWrap(contractKey(req.params.contractId, 'receivable'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM public.contract_receivable WHERE contract_out_id = $1 ORDER BY sort_order, id',
        [req.params.contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getSchedule:', err)
    res.status(500).json({ error: 'Failed to get receivable schedule' })
  }
}

export async function createSchedule(req, res) {
  try {
    const { contractId } = req.params
    const { description, currency_code, amount, exchange_rate, due_date, delay_reason,
            due_offset_days, due_base_bb_type_id, due_base_anchor } = req.body

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM public.contract_receivable WHERE contract_out_id=$1',
      [contractId]
    )
    const sortOrder  = Number(mx[0].m) + 1
    const currency   = currency_code || 'VND'
    const amtVND     = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_receivable
        (contract_out_id,sort_order,description,currency_code,amount,exchange_rate,amount_vnd,due_date,delay_reason,
         due_offset_days,due_base_bb_type_id,due_base_anchor)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [contractId, sortOrder, description || '', currency,
        parseFloat(amount) || 0, parseFloat(exchange_rate) || 1, amtVND,
        due_date || null, delay_reason || '',
        due_offset_days === '' || due_offset_days == null ? null : parseInt(due_offset_days, 10),
        due_base_bb_type_id ? parseInt(due_base_bb_type_id, 10) : null,
        due_base_anchor || null])

    await syncContractRate(contractId, currency, exchange_rate)
    invalidateScheduleTabs(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createSchedule:', err)
    res.status(500).json({ error: 'Failed to create schedule item' })
  }
}

export async function updateSchedule(req, res) {
  try {
    const { description, currency_code, amount, exchange_rate, due_date, delay_reason,
            due_offset_days, due_base_bb_type_id, due_base_anchor } = req.body
    const currency = currency_code || 'VND'
    const amtVND   = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      UPDATE public.contract_receivable SET
        description=$1, currency_code=$2, amount=$3, exchange_rate=$4,
        amount_vnd=$5, due_date=$6, delay_reason=$7,
        due_offset_days=$8, due_base_bb_type_id=$9, due_base_anchor=$10, updated_at=now()
      WHERE id=$11 RETURNING *
    `, [description || '', currency, parseFloat(amount) || 0, parseFloat(exchange_rate) || 1,
        amtVND, due_date || null, delay_reason || '',
        due_offset_days === '' || due_offset_days == null ? null : parseInt(due_offset_days, 10),
        due_base_bb_type_id ? parseInt(due_base_bb_type_id, 10) : null,
        due_base_anchor || null, req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractRate(rows[0].contract_out_id, currency, exchange_rate)
    invalidateScheduleTabs(rows[0].contract_out_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateSchedule:', err)
    res.status(500).json({ error: 'Failed to update schedule item' })
  }
}

export async function deleteSchedule(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_receivable WHERE id=$1 RETURNING id, contract_out_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidateScheduleTabs(rows[0].contract_out_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteSchedule:', err)
    res.status(500).json({ error: 'Failed to delete schedule item' })
  }
}

// ── Actual Payments (Tiền về thực tế) ────────────────────────────────────────

export async function getPayments(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.contractId, 'receivable-payments')) return
    const rows = await cacheWrap(contractKey(req.params.contractId, 'receivable-payments'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM public.contract_receivable_payment WHERE contract_out_id=$1 ORDER BY sort_order, payment_date, id',
        [req.params.contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getPayments:', err)
    res.status(500).json({ error: 'Failed to get payments' })
  }
}

export async function createPayment(req, res) {
  try {
    const { contractId } = req.params
    const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note, schedule_id } = req.body

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM public.contract_receivable_payment WHERE contract_out_id=$1',
      [contractId]
    )
    const sortOrder = Number(mx[0].m) + 1
    const currency  = currency_code || 'VND'
    const amtVND    = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_receivable_payment
        (contract_out_id,sort_order,payment_date,currency_code,amount,exchange_rate,amount_vnd,payment_ratio,note,schedule_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [contractId, sortOrder, payment_date || null, currency,
        parseFloat(amount) || 0, parseFloat(exchange_rate) || 1, amtVND,
        parseFloat(payment_ratio) || 0, note || '',
        schedule_id ? parseInt(schedule_id) : null])

    invalidatePaymentTabs(contractId)
    res.status(201).json(rows[0])

    // Báo PM hợp đồng đã ghi nhận một khoản tiền về (thông tin, không cần xử lý).
    const pms = (await pmUserIds(contractId)).filter(uid => uid !== req.user?.id)
    if (pms.length) {
      const label = await contractLabel(contractId)
      const amt = (parseFloat(amount) || 0).toLocaleString('vi-VN')
      const ngay = payment_date ? ` ngày ${fmtDate(payment_date)}` : ''
      notifyInfo(pms, `HĐ ${label} vừa ghi nhận thanh toán ${amt} ${currency}${ngay}.`)
    }
  } catch (err) {
    console.error('createPayment:', err)
    res.status(500).json({ error: 'Failed to create payment' })
  }
}

export async function updatePayment(req, res) {
  try {
    const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note, schedule_id } = req.body
    const currency = currency_code || 'VND'
    const amtVND   = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      UPDATE public.contract_receivable_payment SET
        payment_date=$1, currency_code=$2, amount=$3, exchange_rate=$4,
        amount_vnd=$5, payment_ratio=$6, note=$7, schedule_id=$8, updated_at=now()
      WHERE id=$9 RETURNING *
    `, [payment_date || null, currency, parseFloat(amount) || 0, parseFloat(exchange_rate) || 1,
        amtVND, parseFloat(payment_ratio) || 0, note || '',
        schedule_id ? parseInt(schedule_id) : null, req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidatePaymentTabs(rows[0].contract_out_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updatePayment:', err)
    res.status(500).json({ error: 'Failed to update payment' })
  }
}

export async function deletePayment(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_receivable_payment WHERE id=$1 RETURNING id, contract_out_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidatePaymentTabs(rows[0].contract_out_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deletePayment:', err)
    res.status(500).json({ error: 'Failed to delete payment' })
  }
}
