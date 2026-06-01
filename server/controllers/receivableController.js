import { pool } from '../db.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

// ── Receivable Schedule (Phải thu theo ĐKTT HĐ) ───────────────────────────────

export async function getSchedule(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.contract_receivable WHERE contract_out_id = $1 ORDER BY sort_order, id',
      [req.params.contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getSchedule:', err)
    res.status(500).json({ error: 'Failed to get receivable schedule' })
  }
}

export async function createSchedule(req, res) {
  try {
    const { contractId } = req.params
    const { description, currency_code, amount, exchange_rate, due_date, delay_reason } = req.body

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM public.contract_receivable WHERE contract_out_id=$1',
      [contractId]
    )
    const sortOrder  = Number(mx[0].m) + 1
    const currency   = currency_code || 'VND'
    const amtVND     = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_receivable
        (contract_out_id,sort_order,description,currency_code,amount,exchange_rate,amount_vnd,due_date,delay_reason)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [contractId, sortOrder, description || '', currency,
        parseFloat(amount) || 0, parseFloat(exchange_rate) || 1, amtVND,
        due_date || null, delay_reason || ''])

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createSchedule:', err)
    res.status(500).json({ error: 'Failed to create schedule item' })
  }
}

export async function updateSchedule(req, res) {
  try {
    const { description, currency_code, amount, exchange_rate, due_date, delay_reason } = req.body
    const currency = currency_code || 'VND'
    const amtVND   = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      UPDATE public.contract_receivable SET
        description=$1, currency_code=$2, amount=$3, exchange_rate=$4,
        amount_vnd=$5, due_date=$6, delay_reason=$7, updated_at=now()
      WHERE id=$8 RETURNING *
    `, [description || '', currency, parseFloat(amount) || 0, parseFloat(exchange_rate) || 1,
        amtVND, due_date || null, delay_reason || '', req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateSchedule:', err)
    res.status(500).json({ error: 'Failed to update schedule item' })
  }
}

export async function deleteSchedule(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_receivable WHERE id=$1 RETURNING id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteSchedule:', err)
    res.status(500).json({ error: 'Failed to delete schedule item' })
  }
}

// ── Actual Payments (Tiền về thực tế) ────────────────────────────────────────

export async function getPayments(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.contract_receivable_payment WHERE contract_out_id=$1 ORDER BY sort_order, payment_date, id',
      [req.params.contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getPayments:', err)
    res.status(500).json({ error: 'Failed to get payments' })
  }
}

export async function createPayment(req, res) {
  try {
    const { contractId } = req.params
    const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note } = req.body

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0) AS m FROM public.contract_receivable_payment WHERE contract_out_id=$1',
      [contractId]
    )
    const sortOrder = Number(mx[0].m) + 1
    const currency  = currency_code || 'VND'
    const amtVND    = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_receivable_payment
        (contract_out_id,sort_order,payment_date,currency_code,amount,exchange_rate,amount_vnd,payment_ratio,note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [contractId, sortOrder, payment_date || null, currency,
        parseFloat(amount) || 0, parseFloat(exchange_rate) || 1, amtVND,
        parseFloat(payment_ratio) || 0, note || ''])

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createPayment:', err)
    res.status(500).json({ error: 'Failed to create payment' })
  }
}

export async function updatePayment(req, res) {
  try {
    const { payment_date, currency_code, amount, exchange_rate, payment_ratio, note } = req.body
    const currency = currency_code || 'VND'
    const amtVND   = calcVND(amount, exchange_rate, currency)

    const { rows } = await pool.query(`
      UPDATE public.contract_receivable_payment SET
        payment_date=$1, currency_code=$2, amount=$3, exchange_rate=$4,
        amount_vnd=$5, payment_ratio=$6, note=$7, updated_at=now()
      WHERE id=$8 RETURNING *
    `, [payment_date || null, currency, parseFloat(amount) || 0, parseFloat(exchange_rate) || 1,
        amtVND, parseFloat(payment_ratio) || 0, note || '', req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('updatePayment:', err)
    res.status(500).json({ error: 'Failed to update payment' })
  }
}

export async function deletePayment(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_receivable_payment WHERE id=$1 RETURNING id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deletePayment:', err)
    res.status(500).json({ error: 'Failed to delete payment' })
  }
}
