import { pool } from '../db.js'
import { computeReceivableDues, TIER_LABEL } from '../utils/receivableDue.js'
import {
  vnToday, lastDayOfMonth, toVnd, loadReceivables, loadProgressByContract, revenueOfYear,
  loadPayables, loadPaymentsByContractIn,
} from '../utils/reportLoaders.js'
import { cacheWrap } from '../cache.js'
import { reportKey, reportNotModified } from '../services/cacheKeys.js'

// Báo cáo tài chính: đọc nhiều, dùng chung. TTL trung bình + invalidate theo nhóm 'debt'
// (version-namespace) khi receivable/payment/HĐ/hóa đơn đổi.
const REPORT_TTL = 2 * 60 * 60 // 2h

// ──────────────────────────────────────────────────────────────────────────────
// Báo cáo tài chính cho kế toán (đọc-only). Tính trên giá trị NGUYÊN TỆ; khi gộp
// nhiều hợp đồng khác loại tiền thì quy về VND bằng exchange_rate (amount_vnd ~ ).
// ──────────────────────────────────────────────────────────────────────────────

// GET /reports/overdue-receivables?asOf=&basis=plan|actual
// Trả về các khoản CÒN NỢ (remaining > 0) kèm hạn hiệu lực, số ngày quá hạn, nhóm nợ.
export async function getOverdueReceivables(req, res) {
  try {
    if (await reportNotModified(req, res, 'debt')) return
    const explicitAsOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : null
    const asOf  = explicitAsOf || vnToday()
    const pit   = !!explicitAsOf
    const basis = req.query.basis === 'plan' ? 'plan' : 'actual'

    const key = await reportKey('debt', 'overdue-receivables', { asOf, basis, pit })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {
      const [receivables, progressByContract] = await Promise.all([loadReceivables(undefined, { asOf, pit }), loadProgressByContract(undefined, { asOf, pit })])
      const computed = computeReceivableDues(receivables, progressByContract, basis, asOf)

      const rows = computed
        .filter(r => r.remaining > 0)
        .map(r => ({
          id: r.id,
          contract_out_id: r.contract_out_id,
          contract_no: r.contract_no,
          project_name: r.project_name,
          customer_code: r.customer_code,
          customer_name: r.customer_name,
          description: r.description,
          currency_code: r.currency_code,
          amount: r.amount,
          paid: r.paid,
          remaining: r.remaining,
          remaining_vnd: toVnd(r.remaining, r.exchange_rate, r.currency_code),
          due_date: r.effective_due,
          days_overdue: r.days_overdue,
          tier: r.tier,
          tier_label: r.tier ? TIER_LABEL[r.tier] : null,
          recovery_ratio: (parseFloat(r.amount) || 0) > 0 ? r.paid / (parseFloat(r.amount) || 1) : 0,
        }))
        .sort((a, b) => b.days_overdue - a.days_overdue)

      return { asOf, basis, rows }
    })

    res.json(payload)
  } catch (err) {
    console.error('getOverdueReceivables:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo cảnh báo nợ.' })
  }
}

// Dự kiến chi NCC tới hết tháng của asOf: Σ theo HĐ nhập max(0, phải-trả-đến-hạn − đã-trả).
// pit=false → truy vấn live (như cũ); pit=true → dựng phải-trả tại asOf từ record_history.
async function computeExpectedPaymentMonth(asOf, eom, pit) {
  if (pit) {
    const [payables, payByCI] = await Promise.all([
      loadPayables(undefined, { asOf, pit }),
      loadPaymentsByContractIn(undefined, { asOf }),
    ])
    const dueByCI = new Map()
    for (const p of payables) {
      const due = p.due_date ? String(p.due_date).slice(0, 10) : null
      if (due && due <= eom) {
        const k = String(p.contract_in_id)
        dueByCI.set(k, (dueByCI.get(k) || 0) + (parseFloat(p.amount_vnd) || 0))
      }
    }
    let sum = 0
    for (const [ci, due] of dueByCI) {
      const paid = (payByCI.get(ci) || []).reduce((s, x) => s + (parseFloat(x.amount_vnd) || 0), 0)
      sum += Math.max(0, due - paid)
    }
    return sum
  }
  const { rows: payRows } = await pool.query(`
    SELECT ci.id,
      COALESCE((SELECT SUM(pa.amount_vnd) FROM contract_in_payable pa
                  WHERE pa.contract_in_id = ci.id AND pa.due_date <= $1), 0) AS due_vnd,
      COALESCE((SELECT SUM(pm.amount_vnd) FROM contract_in_payment pm
                  WHERE pm.contract_in_id = ci.id AND pm.payment_date <= $2::date), 0) AS paid_vnd
    FROM contract_in ci
  `, [eom, asOf])
  return payRows.reduce(
    (s, c) => s + Math.max(0, (parseFloat(c.due_vnd) || 0) - (parseFloat(c.paid_vnd) || 0)), 0)
}

// GET /reports/cashflow-summary
// Dòng tiền cho trang chủ kế toán: doanh thu YTD (placeholder GĐ3), dự kiến thu/chi
// tháng hiện tại (quy VND), và tổng quan nợ quá hạn.
export async function getCashflowSummary(req, res) {
  try {
    if (await reportNotModified(req, res, 'debt')) return
    const explicitAsOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : null
    const asOf = explicitAsOf || vnToday()
    const pit  = !!explicitAsOf
    const eom  = lastDayOfMonth(asOf)
    const year = asOf.slice(0, 4)

    const key = await reportKey('debt', 'cashflow-summary', { asOf, pit })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {
      const [receivables, progressByContract] = await Promise.all([loadReceivables(undefined, { asOf, pit }), loadProgressByContract(undefined, { asOf, pit })])
      const computed = computeReceivableDues(receivables, progressByContract, 'actual', asOf)

      let expectedReceiptMonth = 0, overdueTotal = 0, overdueCount = 0
      for (const r of computed) {
        if (r.remaining <= 0) continue
        const vnd = toVnd(r.remaining, r.exchange_rate, r.currency_code)
        if (r.effective_due && r.effective_due <= eom) expectedReceiptMonth += vnd   // tới hạn trong/đến tháng này, chưa thu
        if (r.days_overdue > 0) { overdueTotal += vnd; overdueCount++ }
      }

      // Dự kiến chi NCC tháng này (xấp xỉ cấp hợp đồng nhập: phải trả đến hạn − đã trả).
      // Đã trả chỉ tính tới asOf để khớp khi xem lại 1 thời điểm trong quá khứ.
      const expectedPaymentMonth = await computeExpectedPaymentMonth(asOf, eom, pit)

      // Doanh thu đã xuất hóa đơn lũy kế từ đầu năm tới asOf (quy VND).
      const revenueYtd = await revenueOfYear(year, pool, asOf, pit)

      return {
        asOf, year,
        revenue_ytd: revenueYtd,
        expected_receipt_month: expectedReceiptMonth,
        expected_payment_month: expectedPaymentMonth,
        overdue_total_vnd: overdueTotal,
        overdue_count: overdueCount,
      }
    })

    res.json(payload)
  } catch (err) {
    console.error('getCashflowSummary:', err)
    res.status(500).json({ error: 'Không thể tải tổng quan dòng tiền.' })
  }
}
