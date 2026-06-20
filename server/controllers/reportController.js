import { pool } from '../db.js'
import { computeReceivableDues, TIER_LABEL } from '../utils/receivableDue.js'
import {
  vnToday, lastDayOfMonth, toVnd, loadReceivables, loadProgressByContract, revenueOfYear,
} from '../utils/reportLoaders.js'

// ──────────────────────────────────────────────────────────────────────────────
// Báo cáo tài chính cho kế toán (đọc-only). Tính trên giá trị NGUYÊN TỆ; khi gộp
// nhiều hợp đồng khác loại tiền thì quy về VND bằng exchange_rate (amount_vnd ~ ).
// ──────────────────────────────────────────────────────────────────────────────

// GET /reports/overdue-receivables?asOf=&basis=plan|actual
// Trả về các khoản CÒN NỢ (remaining > 0) kèm hạn hiệu lực, số ngày quá hạn, nhóm nợ.
export async function getOverdueReceivables(req, res) {
  try {
    const asOf  = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : vnToday()
    const basis = req.query.basis === 'plan' ? 'plan' : 'actual'

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

    res.json({ asOf, basis, rows })
  } catch (err) {
    console.error('getOverdueReceivables:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo cảnh báo nợ.' })
  }
}

// GET /reports/cashflow-summary
// Dòng tiền cho trang chủ kế toán: doanh thu YTD (placeholder GĐ3), dự kiến thu/chi
// tháng hiện tại (quy VND), và tổng quan nợ quá hạn.
export async function getCashflowSummary(req, res) {
  try {
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : vnToday()
    const eom  = lastDayOfMonth(asOf)
    const year = asOf.slice(0, 4)

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
    const { rows: payRows } = await pool.query(`
      SELECT ci.id,
        COALESCE((SELECT SUM(pa.amount_vnd) FROM contract_in_payable pa
                    WHERE pa.contract_in_id = ci.id AND pa.due_date <= $1), 0) AS due_vnd,
        COALESCE((SELECT SUM(pm.amount_vnd) FROM contract_in_payment pm
                    WHERE pm.contract_in_id = ci.id AND pm.payment_date <= $2::date), 0) AS paid_vnd
      FROM contract_in ci
    `, [eom, asOf])
    const expectedPaymentMonth = payRows.reduce(
      (s, c) => s + Math.max(0, (parseFloat(c.due_vnd) || 0) - (parseFloat(c.paid_vnd) || 0)), 0)

    // Doanh thu đã xuất hóa đơn lũy kế từ đầu năm tới asOf (quy VND).
    const revenueYtd = await revenueOfYear(year, pool, asOf)

    res.json({
      asOf, year,
      revenue_ytd: revenueYtd,
      expected_receipt_month: expectedReceiptMonth,
      expected_payment_month: expectedPaymentMonth,
      overdue_total_vnd: overdueTotal,
      overdue_count: overdueCount,
    })
  } catch (err) {
    console.error('getCashflowSummary:', err)
    res.status(500).json({ error: 'Không thể tải tổng quan dòng tiền.' })
  }
}
