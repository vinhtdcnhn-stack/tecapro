import { pool } from '../db.js'
import { asOfSnapshot } from './historyAsOf.js'
import { diffDays } from './receivableDue.js'

// Bản "as-of" của các loader trong reportLoaders.js: dựng dữ liệu báo cáo từ
// record_history (migration 062) thay vì bảng live, để số liệu phản ánh ĐÚNG trạng
// thái tại thời điểm asOf (giá trị HĐ, lịch phải thu, trạng thái việc... đã bị sửa
// sau đó vẫn hiện đúng giá trị cũ). Chỉ chạy khi request có asOf rõ ràng (pit).
//
// Nguyên tắc: trường mutable lấy từ snapshot; ngữ cảnh ít đổi (tên KH/NCC/phòng ban,
// HĐ nhập) lấy từ bảng live. Hàng tạo-sau-asOf hoặc đã xóa tại asOf bị loại tự nhiên
// vì không có trong snapshot.

const num = (v) => parseFloat(v) || 0
const iso = (v) => (v ? String(v).slice(0, 10) : null)

// Map(contract_out_id(string) → {…cột contract_out tại asOf, customer_code, customer_name})
// Loại HĐ đã xóa (is_deleted) tại asOf. Tên KH lấy live (customer không theo dõi lịch sử).
export async function contractsAsOfMap(asOf, db = pool) {
  const [snap, { rows: custRows }] = await Promise.all([
    asOfSnapshot('contract_out', asOf, db),
    db.query('SELECT id, code, name FROM customer'),
  ])
  const custById = new Map(custRows.map((c) => [String(c.id), c]))
  const map = new Map()
  for (const [id, d] of snap) {
    if (d.is_deleted) continue
    const cu = custById.get(String(d.customer_id)) || {}
    map.set(id, { ...d, customer_code: cu.code ?? null, customer_name: cu.name ?? null })
  }
  return map
}

// Tương đương loadContracts(...) nhưng tại asOf. range: { from, to } lọc theo contract_date
// (lấy theo snapshot). Trả về cùng hình dạng hàng như loadContracts.
export async function loadContractsAsOf({ from, to, asOf } = {}, db = pool) {
  const cmap = await contractsAsOfMap(asOf, db)
  const out = []
  for (const c of cmap.values()) {
    const cd = iso(c.contract_date)
    if (from && (!cd || cd < from)) continue
    if (to && (!cd || cd > to)) continue
    out.push({
      id: c.id, contract_no: c.contract_no, project_name: c.project_name,
      tender_name: c.tender_name, contract_date: c.contract_date, status: c.status,
      currency_code: c.currency_code, exchange_rate: c.exchange_rate,
      amount_after_vat: c.amount_after_vat,
      customer_id: c.customer_id, customer_code: c.customer_code, customer_name: c.customer_name,
    })
  }
  out.sort((a, b) => Number(a.id) - Number(b.id))
  return out
}

// Tổng đã thu theo từng khoản (schedule_id) tới asOf. Tiền về là dữ liệu theo ngày
// (payment_date) nên cắt trực tiếp trên bảng live, không cần snapshot.
async function paidByScheduleAsOf(asOf, db = pool) {
  const { rows } = await db.query(`
    SELECT schedule_id, COALESCE(SUM(amount), 0) AS paid
      FROM contract_receivable_payment
     WHERE schedule_id IS NOT NULL AND payment_date <= $1::date
     GROUP BY schedule_id`, [asOf])
  return new Map(rows.map((r) => [String(r.schedule_id), num(r.paid)]))
}

// Tương đương loadReceivables(...) nhưng tại asOf: khoản phải thu + ngữ cảnh HĐ + đã thu.
export async function loadReceivablesAsOf({ asOf } = {}, db = pool) {
  const [snap, cmap, paidBySchedule] = await Promise.all([
    asOfSnapshot('contract_receivable', asOf, db),
    contractsAsOfMap(asOf, db),
    paidByScheduleAsOf(asOf, db),
  ])
  const out = []
  for (const [id, r] of snap) {
    const c = cmap.get(String(r.contract_out_id))
    if (!c) continue              // HĐ chưa tồn tại / đã xóa tại asOf
    out.push({
      id: Number(id), contract_out_id: r.contract_out_id, description: r.description,
      amount: r.amount, currency_code: r.currency_code, exchange_rate: r.exchange_rate,
      due_date: r.due_date, due_offset_days: r.due_offset_days,
      due_base_bb_type_id: r.due_base_bb_type_id, due_base_anchor: r.due_base_anchor,
      sort_order: r.sort_order,
      contract_no: c.contract_no, project_name: c.project_name, contract_date: c.contract_date,
      customer_id: c.customer_id, contract_amount: c.amount_after_vat,
      customer_code: c.customer_code, customer_name: c.customer_name,
      paid: paidBySchedule.get(String(id)) || 0,
    })
  }
  out.sort((a, b) => Number(a.contract_out_id) - Number(b.contract_out_id)
    || (a.sort_order - b.sort_order) || (a.id - b.id))
  return out
}

// Tương đương loadPayables(...) nhưng tại asOf. Ngữ cảnh HĐ nhập + NCC lấy live.
export async function loadPayablesAsOf(asOf, db = pool) {
  const [snap, { rows: ciRows }] = await Promise.all([
    asOfSnapshot('contract_in_payable', asOf, db),
    db.query(`SELECT ci.id, ci.contract_no, ci.contract_date, ci.contract_out_id,
                     s.code AS supplier_code, s.name AS supplier_name
                FROM contract_in ci LEFT JOIN supplier s ON s.id = ci.supplier_id`),
  ])
  const ciById = new Map(ciRows.map((c) => [String(c.id), c]))
  const out = []
  for (const [id, p] of snap) {
    const ci = ciById.get(String(p.contract_in_id))
    if (!ci) continue
    out.push({
      id: Number(id), contract_in_id: p.contract_in_id, description: p.description,
      amount: p.amount, currency_code: p.currency_code, exchange_rate: p.exchange_rate,
      amount_vnd: p.amount_vnd, due_date: p.due_date,
      contract_no: ci.contract_no, contract_date: ci.contract_date, contract_out_id: ci.contract_out_id,
      supplier_code: ci.supplier_code, supplier_name: ci.supplier_name,
    })
  }
  out.sort((a, b) => Number(a.contract_in_id) - Number(b.contract_in_id)
    || (iso(a.due_date) || '').localeCompare(iso(b.due_date) || '') || (a.id - b.id))
  return out
}

// Doanh thu xuất HĐ tại asOf, gộp theo từng hóa đơn (quy VND). Item amount + header
// currency/rate/date đều lấy theo snapshot; chỉ tính hóa đơn có invoice_date ≤ asOf.
// Trả về [{ contract_out_id, vnd, invoice_date }].
async function invoicesAsOf(asOf, db = pool) {
  const [invSnap, itemSnap] = await Promise.all([
    asOfSnapshot('contract_out_invoice', asOf, db),
    asOfSnapshot('contract_out_invoice_item', asOf, db),
  ])
  const sumByInvoice = new Map()
  for (const it of itemSnap.values()) {
    const k = String(it.invoice_id)
    if (!invSnap.has(k)) continue
    sumByInvoice.set(k, (sumByInvoice.get(k) || 0) + num(it.amount_after_vat))
  }
  const out = []
  for (const [id, inv] of invSnap) {
    const d = iso(inv.invoice_date)
    if (!d || d > asOf) continue
    const sum = sumByInvoice.get(String(id)) || 0
    const vnd = inv.currency_code === 'VND' ? sum : sum * (num(inv.exchange_rate) || 1)
    out.push({ contract_out_id: inv.contract_out_id, vnd, invoice_date: d })
  }
  return out
}

// Tương đương loadInvoicedByContract(...) nhưng tại asOf → Map(contract_out_id → vnd).
export async function loadInvoicedByContractAsOf(asOf, db = pool) {
  const invoices = await invoicesAsOf(asOf, db)
  const map = new Map()
  for (const i of invoices) {
    const k = String(i.contract_out_id)
    map.set(k, (map.get(k) || 0) + i.vnd)
  }
  return map
}

// Tương đương revenueOfYear(...) nhưng tại asOf: tổng VND hóa đơn của 1 năm tới asOf.
export async function revenueOfYearAsOf(year, asOf, db = pool) {
  const invoices = await invoicesAsOf(asOf, db)
  const y = String(year)
  return invoices.reduce((s, i) => (i.invoice_date.slice(0, 4) === y ? s + i.vnd : s), 0)
}

// Tương đương getOverdueTasks nhưng tại asOf: việc quá hạn dựa trên TRẠNG THÁI tại asOf
// (không phải status hiện tại), loại việc tạo-sau-asOf / đã xóa, và việc của HĐ đã xóa.
export async function overdueTasksAsOf(asOf, db = pool) {
  const [snap, cmap, { rows: depts }, { rows: users }] = await Promise.all([
    asOfSnapshot('contract_task', asOf, db),
    contractsAsOfMap(asOf, db),
    db.query('SELECT id, name FROM department'),
    db.query('SELECT id, full_name FROM app_user'),
  ])
  const deptById = new Map(depts.map((d) => [String(d.id), d.name]))
  const userById = new Map(users.map((u) => [String(u.id), u.full_name]))
  const rows = []
  for (const [id, t] of snap) {
    const due = iso(t.due_date)
    if (!due || due >= asOf) continue                       // chưa quá hạn tại asOf
    if (t.status === 'Hoàn thành' || t.status === 'Hủy') continue   // đã kết thúc tại asOf
    const c = cmap.get(String(t.contract_out_id))
    if (!c) continue                                        // HĐ chưa tồn tại / đã xóa
    rows.push({
      id: Number(id), contract_out_id: t.contract_out_id,
      contract_no: c.contract_no, project_name: c.project_name, customer_name: c.customer_name,
      title: t.title, department_name: deptById.get(String(t.department_id)) || null,
      assigned_to_name: userById.get(String(t.assigned_to)) || null,
      priority: t.priority, status: t.status, due_date: due,
      days_overdue: diffDays(due, asOf),
    })
  }
  rows.sort((a, b) => b.days_overdue - a.days_overdue || a.due_date.localeCompare(b.due_date))
  return rows
}
