import { pool } from '../db.js'
import { computeReceivableDues, TIER_LABEL } from '../utils/receivableDue.js'
import {
  vnToday, lastDayOfMonth, toVnd, loadReceivables, loadProgressByContract, revenueOfYear,
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
    const basis = req.query.basis === 'plan' ? 'plan' : 'actual'

    const key = await reportKey('debt', 'overdue-receivables', { asOf, basis })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {
      const [receivables, progressByContract] = await Promise.all([loadReceivables(undefined, { asOf }), loadProgressByContract()])
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
// Đọc bảng live; chỉ cắt theo ngày (đợt đến hạn ≤ eom, đã trả ≤ asOf).
async function computeExpectedPaymentMonth(asOf, eom) {
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
    const eom  = lastDayOfMonth(asOf)
    const year = asOf.slice(0, 4)

    const key = await reportKey('debt', 'cashflow-summary', { asOf })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {
      const [receivables, progressByContract] = await Promise.all([loadReceivables(undefined, { asOf }), loadProgressByContract()])
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
      const expectedPaymentMonth = await computeExpectedPaymentMonth(asOf, eom)

      // Doanh thu đã xuất hóa đơn lũy kế từ đầu năm tới asOf (quy VND).
      const revenueYtd = await revenueOfYear(year, pool, asOf)

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

// GET /reports/invoice-revenue?from=&to=
// Doanh thu đã xuất hóa đơn (HĐ bán) theo từng hóa đơn, lọc theo khoảng ngày xuất.
// from/to (tùy chọn, yyyy-mm-dd): giới hạn i.invoice_date. Trả về danh sách hóa đơn
// (quy VND) + tổng.
export async function getInvoiceRevenue(req, res) {
  try {
    if (await reportNotModified(req, res, 'debt')) return
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : null
    const to   = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)   ? req.query.to   : null

    const key = await reportKey('debt', 'invoice-revenue', { from, to })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {
      const { rows } = await pool.query(`
        SELECT i.id, i.invoice_no, i.invoice_date, i.contract_out_id,
               i.currency_code, i.exchange_rate,
               co.contract_no, co.project_name,
               cu.name AS customer_name,
               SUM(it.amount_after_vat) AS amount_native,
               SUM(CASE WHEN i.currency_code = 'VND' THEN it.amount_after_vat
                        ELSE it.amount_after_vat * COALESCE(i.exchange_rate, 1) END) AS amount_vnd
          FROM contract_out_invoice i
          JOIN contract_out_invoice_item it ON it.invoice_id = i.id
          JOIN contract_out co ON co.id = i.contract_out_id
          LEFT JOIN customer cu ON cu.id = co.customer_id
         WHERE ($1::date IS NULL OR i.invoice_date >= $1::date)
           AND ($2::date IS NULL OR i.invoice_date <= $2::date)
         GROUP BY i.id, co.contract_no, co.project_name, cu.name
         ORDER BY i.invoice_date DESC NULLS LAST, i.id DESC`, [from, to])

      const list = rows.map(r => ({
        id: r.id,
        invoice_no: r.invoice_no,
        invoice_date: r.invoice_date,
        contract_out_id: r.contract_out_id,
        contract_no: r.contract_no,
        project_name: r.project_name,
        customer_name: r.customer_name,
        currency_code: r.currency_code,
        amount_native: parseFloat(r.amount_native) || 0,
        amount_vnd: parseFloat(r.amount_vnd) || 0,
      }))
      const total_vnd = list.reduce((s, r) => s + r.amount_vnd, 0)
      return { from, to, total_vnd, count: list.length, rows: list }
    })

    res.json(payload)
  } catch (err) {
    console.error('getInvoiceRevenue:', err)
    res.status(500).json({ error: 'Không thể tải doanh thu xuất hóa đơn.' })
  }
}
