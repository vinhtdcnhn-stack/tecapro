import { computeReceivableDues, debtTier, TIER_LABEL, diffDays } from '../utils/receivableDue.js'
import {
  vnToday, lastDayOfMonth, toVnd,
  loadReceivables, loadProgressByContract, loadPaymentsByContract,
  loadContracts, loadPayables, loadPaymentsByContractIn, loadInvoicedByContract,
} from '../utils/reportLoaders.js'

// Báo cáo công nợ (đọc-only): phải thu KH (#3/#4), phải trả NCC (#5), tổng kết tiến
// độ thu (#6), tổng hợp theo KH (#8) và theo HĐ (#9).

const validDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const iso = (v) => (v ? String(v).slice(0, 10) : null)

// Ngày thu gần nhất theo từng khoản (schedule_id) — cho cột "Ngày thanh toán".
function latestPaymentByReceivable(payByContract) {
  const m = new Map()
  for (const pays of payByContract.values()) {
    for (const p of pays) {
      if (!p.schedule_id) continue
      const d = iso(p.payment_date)
      if (!d) continue
      const k = String(p.schedule_id)
      if (!m.has(k) || d > m.get(k)) m.set(k, d)
    }
  }
  return m
}

// ── #3 / #4: Công nợ phải thu KH (basis=plan|actual) ──────────────────────────
export async function getReceivablesReport(req, res) {
  try {
    const asOf  = validDate(req.query.asOf) || vnToday()
    const to    = validDate(req.query.to) || lastDayOfMonth(asOf)
    const from  = validDate(req.query.from) || null
    const basis = req.query.basis === 'plan' ? 'plan' : 'actual'
    const today = asOf

    const [recv, prog, payByContract] = await Promise.all([
      loadReceivables(undefined, { asOf }), loadProgressByContract(), loadPaymentsByContract(undefined, { asOf }),
    ])
    const computed = computeReceivableDues(recv, prog, basis, today)
    const payDate = latestPaymentByReceivable(payByContract)

    const rows = computed
      .filter(r => r.remaining > 0 && r.effective_due && r.effective_due <= to)
      .map(r => {
        const cAmt = parseFloat(r.contract_amount) || 0
        const amt  = parseFloat(r.amount) || 0
        return {
          id: r.id,
          contract_out_id: r.contract_out_id,
          customer_code: r.customer_code, customer_name: r.customer_name,
          contract_no: r.contract_no, contract_date: iso(r.contract_date),
          contract_amount: cAmt,
          description: r.description,
          ratio_pct: cAmt > 0 ? (amt / cAmt) * 100 : null,
          currency_code: r.currency_code,
          amount: amt, paid: r.paid, remaining: r.remaining,
          remaining_vnd: toVnd(r.remaining, r.exchange_rate, r.currency_code),
          payment_date: payDate.get(String(r.id)) || null,
          due_date: r.effective_due,
          recovery_ratio: amt > 0 ? r.paid / amt : 0,
          days_overdue: r.days_overdue,
          tier: r.tier, tier_label: r.tier ? TIER_LABEL[r.tier] : null,
        }
      })
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

    res.json({ from, to, basis, rows })
  } catch (err) {
    console.error('getReceivablesReport:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo công nợ phải thu.' })
  }
}

// ── #5: Công nợ phải trả NCC (phân bổ FIFO tiền đã trả cho các đợt theo hạn) ────
export async function getPayablesReport(req, res) {
  try {
    const asOf = validDate(req.query.asOf) || vnToday()
    const to   = validDate(req.query.to) || lastDayOfMonth(asOf)
    const from = validDate(req.query.from) || null
    const today = asOf

    const [payables, payByCI] = await Promise.all([loadPayables(), loadPaymentsByContractIn(undefined, { asOf })])

    // Gom đợt phải trả theo hợp đồng nhập, phân bổ FIFO tổng đã trả theo thứ tự hạn.
    const byCI = new Map()
    for (const p of payables) {
      const k = String(p.contract_in_id)
      if (!byCI.has(k)) byCI.set(k, [])
      byCI.get(k).push(p)
    }

    const rows = []
    for (const [ci, items] of byCI) {
      const totalPaid = (payByCI.get(ci) || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      let remainPaid = totalPaid
      for (const p of items) {
        const amt = parseFloat(p.amount) || 0
        const paid = Math.min(amt, Math.max(0, remainPaid))
        remainPaid -= paid
        const remaining = amt - paid
        const due = iso(p.due_date)
        const daysOverdue = (due && remaining > 0) ? diffDays(due, today) : 0
        if (remaining > 0 && due && due <= to) {
          const tier = debtTier(daysOverdue)
          rows.push({
            id: p.id, contract_in_id: p.contract_in_id, contract_out_id: p.contract_out_id,
            supplier_code: p.supplier_code, supplier_name: p.supplier_name,
            contract_no: p.contract_no, contract_date: iso(p.contract_date),
            description: p.description, currency_code: p.currency_code,
            amount: amt, paid, remaining,
            remaining_vnd: toVnd(remaining, p.exchange_rate, p.currency_code),
            due_date: due, days_overdue: daysOverdue,
            tier, tier_label: tier ? TIER_LABEL[tier] : null,
          })
        }
      }
    }
    rows.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    res.json({ from, to, rows })
  } catch (err) {
    console.error('getPayablesReport:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo công nợ phải trả.' })
  }
}

// Phân nhóm số ngày chậm tiền về (#6).
function delayCategory(days) {
  if (days <= 0)   return 'Đúng hạn'
  if (days <= 90)  return 'Từ 0-3 tháng'
  if (days <= 180) return 'Từ 3-6 tháng'
  if (days <= 270) return 'Từ 6-9 tháng'
  return 'Trên 9 tháng'
}

// ── #6: Tổng kết tiến độ thu (số ngày chậm theo mốc bị nợ lâu nhất, kế hoạch gốc) ─
export async function getProgressCollection(req, res) {
  try {
    const today = vnToday()
    const [recv, prog, payByContract, contracts] = await Promise.all([
      loadReceivables(), loadProgressByContract(), loadPaymentsByContract(), loadContracts(),
    ])
    const computed = computeReceivableDues(recv, prog, 'plan', today)
    const payDate = latestPaymentByReceivable(payByContract)

    // Gom theo HĐ: số ngày chậm = MAX trên các khoản (đã thu: ngày thu−hạn; chưa thu: hôm nay−hạn).
    const delayByContract = new Map()
    for (const r of computed) {
      if (!r.effective_due) continue
      const k = String(r.contract_out_id)
      const late = r.remaining <= 0
        ? diffDays(r.effective_due, payDate.get(String(r.id)) || today)
        : diffDays(r.effective_due, today)
      if (!delayByContract.has(k) || late > delayByContract.get(k)) delayByContract.set(k, late)
    }

    const rows = contracts.map(c => {
      const k = String(c.id)
      const pays = payByContract.get(k) || []
      const collectedVnd = pays.reduce((s, p) => s + (parseFloat(p.amount_vnd) || 0), 0)
      const valueVnd = toVnd(c.amount_after_vat, c.exchange_rate, c.currency_code)
      const delay = delayByContract.has(k) ? delayByContract.get(k) : 0
      return {
        contract_out_id: c.id, contract_no: c.contract_no,
        customer_name: c.customer_name, project_name: c.project_name,
        contract_date: iso(c.contract_date),
        value_vnd: valueVnd, collected_vnd: collectedVnd,
        remaining_vnd: Math.max(0, valueVnd - collectedVnd),
        delay_days: delay, category: delayCategory(delay),
      }
    }).sort((a, b) => b.delay_days - a.delay_days)

    res.json({ asOf: today, rows })
  } catch (err) {
    console.error('getProgressCollection:', err)
    res.status(500).json({ error: 'Không thể tải tổng kết tiến độ thu.' })
  }
}

// Tính công nợ theo từng HĐ (dùng cho #8 và #9). range = lọc HĐ theo ngày ký
// ({from,to}) + asOf (xem tại 1 thời điểm: đã thu/đã xuất HĐ chỉ tính tới asOf, quá hạn theo asOf).
async function computeContractDebt(range = {}) {
  const { asOf } = range
  const today = asOf || vnToday()
  const [recv, prog, payByContract, contracts, invoicedByContract] = await Promise.all([
    loadReceivables(undefined, { asOf }), loadProgressByContract(), loadPaymentsByContract(undefined, { asOf }),
    loadContracts(undefined, range), loadInvoicedByContract(undefined, { asOf }),
  ])
  const computed = computeReceivableDues(recv, prog, 'actual', today)

  // Gom phải thu theo HĐ: tổng lịch (VND) + hạn cuối + còn quá hạn.
  const aggr = new Map()
  for (const r of computed) {
    const k = String(r.contract_out_id)
    if (!aggr.has(k)) aggr.set(k, { schedVnd: 0, lastDue: null, anyOverdue: false })
    const a = aggr.get(k)
    a.schedVnd += toVnd(r.amount, r.exchange_rate, r.currency_code)
    if (r.effective_due && (!a.lastDue || r.effective_due > a.lastDue)) a.lastDue = r.effective_due
    if (r.days_overdue > 0) a.anyOverdue = true
  }

  return contracts.map(c => {
    const k = String(c.id)
    const a = aggr.get(k) || { schedVnd: 0, lastDue: null, anyOverdue: false }
    const pays = payByContract.get(k) || []
    const paidVnd = pays.reduce((s, p) => s + (parseFloat(p.amount_vnd) || 0), 0)
    const valueVnd = toVnd(c.amount_after_vat, c.exchange_rate, c.currency_code)
    const invoicedVnd = invoicedByContract.get(String(c.id)) ?? 0
    const outstanding = Math.max(0, a.schedVnd - paidVnd)
    const lastOverdue = (outstanding > 0 && a.lastDue) ? Math.max(0, diffDays(a.lastDue, today)) : 0
    const status = outstanding <= 0 ? 'Đã thanh toán' : (a.anyOverdue ? 'Quá hạn' : 'Trong hạn')
    return {
      contract_out_id: c.id, contract_no: c.contract_no,
      customer_id: c.customer_id, customer_code: c.customer_code, customer_name: c.customer_name,
      project_name: c.project_name, contract_date: iso(c.contract_date),
      value_vnd: valueVnd, invoiced_vnd: invoicedVnd, paid_vnd: paidVnd,
      outstanding_vnd: outstanding, last_due: a.lastDue,
      days_overdue: lastOverdue, status,
    }
  })
}

// ── #9: Tổng hợp công nợ theo hợp đồng ────────────────────────────────────────
export async function getDebtByContract(req, res) {
  try {
    const range = { from: validDate(req.query.from), to: validDate(req.query.to), asOf: validDate(req.query.asOf) }
    const rows = await computeContractDebt(range)
    const totals = rows.reduce((t, r) => {
      t.value += r.value_vnd; t.paid += r.paid_vnd; t.outstanding += r.outstanding_vnd
      return t
    }, { value: 0, paid: 0, outstanding: 0 })
    res.json({ rows: rows.sort((a, b) => b.outstanding_vnd - a.outstanding_vnd), totals })
  } catch (err) {
    console.error('getDebtByContract:', err)
    res.status(500).json({ error: 'Không thể tải tổng hợp công nợ theo HĐ.' })
  }
}

// ── #8: Tổng hợp công nợ theo khách hàng (+ chỉ tiêu tổng + top 10) ────────────
export async function getDebtByCustomer(req, res) {
  try {
    const range = { from: validDate(req.query.from), to: validDate(req.query.to), asOf: validDate(req.query.asOf) }
    const contractRows = await computeContractDebt(range)
    const byCust = new Map()
    for (const c of contractRows) {
      const k = String(c.customer_id ?? 'none')
      if (!byCust.has(k)) byCust.set(k, {
        customer_id: c.customer_id, customer_code: c.customer_code, customer_name: c.customer_name || 'Chưa gán KH',
        total_contracts: 0, value_vnd: 0, invoiced_vnd: 0, paid_vnd: 0, outstanding_vnd: 0,
      })
      const a = byCust.get(k)
      a.total_contracts += 1
      a.value_vnd += c.value_vnd
      a.invoiced_vnd += c.invoiced_vnd
      a.paid_vnd += c.paid_vnd
      a.outstanding_vnd += c.outstanding_vnd
    }
    // Tỷ lệ thu tiền = đã thu / đã xuất HĐ (theo file); chưa xuất HĐ thì lấy / giá trị HĐ.
    const ratioOf = (paid, invoiced, value) => invoiced > 0 ? paid / invoiced : (value > 0 ? paid / value : 0)
    const rows = [...byCust.values()].map(a => ({
      ...a, collection_ratio: ratioOf(a.paid_vnd, a.invoiced_vnd, a.value_vnd),
    })).sort((x, y) => y.outstanding_vnd - x.outstanding_vnd)

    const totals = {
      total_value: rows.reduce((s, r) => s + r.value_vnd, 0),
      total_invoiced: rows.reduce((s, r) => s + r.invoiced_vnd, 0),
      total_paid: rows.reduce((s, r) => s + r.paid_vnd, 0),
      total_outstanding: rows.reduce((s, r) => s + r.outstanding_vnd, 0),
      in_term: contractRows.filter(c => c.status === 'Trong hạn').reduce((s, c) => s + c.outstanding_vnd, 0),
      overdue: contractRows.filter(c => c.status === 'Quá hạn').reduce((s, c) => s + c.outstanding_vnd, 0),
    }
    totals.collection_ratio = ratioOf(totals.total_paid, totals.total_invoiced, totals.total_value)
    const top10 = rows.slice(0, 10)

    res.json({ rows, totals, top10 })
  } catch (err) {
    console.error('getDebtByCustomer:', err)
    res.status(500).json({ error: 'Không thể tải tổng hợp công nợ theo KH.' })
  }
}
