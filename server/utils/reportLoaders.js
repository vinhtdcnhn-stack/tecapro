import { pool } from '../db.js'
import {
  loadContractsAsOf, loadReceivablesAsOf, loadPayablesAsOf,
  loadInvoicedByContractAsOf, revenueOfYearAsOf,
} from './reportLoaders.asof.js'

// Bộ nạp dữ liệu + helper dùng chung cho các báo cáo tài chính (kế toán). Tính trên
// giá trị NGUYÊN TỆ; quy VND bằng exchange_rate khi cần gộp nhiều loại tiền.
//
// Tham số `pit` (point-in-time): khi request có asOf rõ ràng, các loader uỷ quyền sang
// bản "as-of" (reportLoaders.asof.js) để dựng số liệu từ record_history (giá trị đúng
// tại thời điểm quá khứ). Mặc định pit=false → đọc bảng live như cũ (không đổi hành vi).

const pad = (n) => String(n).padStart(2, '0')

export const vnToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

export const lastDayOfMonth = (asOf) => {
  const [y, m] = asOf.split('-').map(Number)
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`
}

export const toVnd = (amount, rate, currency) => {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate) || 1
  return currency === 'VND' ? a : a * r
}

// Khoản phải thu + ngữ cảnh HĐ + tổng đã thu (theo schedule_id).
// asOf (tùy chọn): chỉ cộng tiền đã thu có ngày ≤ asOf (xem dashboard tại 1 thời điểm quá khứ).
export async function loadReceivables(db = pool, { asOf, pit } = {}) {
  if (pit && asOf) return loadReceivablesAsOf({ asOf }, db)
  const { rows } = await db.query(`
    SELECT r.id, r.contract_out_id, r.description, r.amount, r.currency_code, r.exchange_rate,
           r.due_date, r.due_offset_days, r.due_base_bb_type_id, r.due_base_anchor, r.sort_order,
           c.contract_no, c.project_name, c.contract_date, c.customer_id,
           c.amount_after_vat AS contract_amount,
           cu.code AS customer_code, cu.name AS customer_name,
           COALESCE((SELECT SUM(p.amount) FROM contract_receivable_payment p
                       WHERE p.schedule_id = r.id
                         AND ($1::date IS NULL OR p.payment_date <= $1::date)), 0) AS paid
      FROM contract_receivable r
      JOIN contract_out c ON c.id = r.contract_out_id AND COALESCE(c.is_deleted, false) = false
      LEFT JOIN customer cu ON cu.id = c.customer_id
     ORDER BY c.id, r.sort_order, r.id`, [asOf || null])
  return rows
}

// Map(contract_out_id(string) → progressRows[] đã sort) để dựng bbDateMap.
export async function loadProgressByContract(db = pool) {
  const { rows } = await db.query(`
    SELECT contract_out_id, id, bb_type_id, planned_date, actual_date, offset_days, base_bb_type_id, base_anchor
      FROM contract_out_progress ORDER BY contract_out_id, sort_order, id`)
  return groupBy(rows, 'contract_out_id')
}

// Tiền về thực tế theo HĐ (để biết ngày thu thực + tổng đã thu cấp HĐ).
// asOf (tùy chọn): chỉ lấy khoản thu có ngày ≤ asOf.
export async function loadPaymentsByContract(db = pool, { asOf } = {}) {
  const { rows } = await db.query(`
    SELECT contract_out_id, id, amount, currency_code, exchange_rate, amount_vnd, payment_date, schedule_id
      FROM contract_receivable_payment
     WHERE ($1::date IS NULL OR payment_date <= $1::date)
     ORDER BY contract_out_id, payment_date NULLS LAST, id`, [asOf || null])
  return groupBy(rows, 'contract_out_id')
}

// Hợp đồng bán + khách hàng (chưa xóa). Lọc tùy chọn theo ngày ký (contract_date)
// trong khoảng [from, to] — dùng cho bộ chọn khoảng thời gian ở dashboard điều hành.
export async function loadContracts(db = pool, { from, to, asOf, pit } = {}) {
  if (pit && asOf) return loadContractsAsOf({ from, to, asOf }, db)
  const cond = ['COALESCE(c.is_deleted, false) = false']
  const params = []
  if (from) { params.push(from); cond.push(`c.contract_date >= $${params.length}`) }
  if (to)   { params.push(to);   cond.push(`c.contract_date <= $${params.length}`) }
  if (asOf) { params.push(asOf); cond.push(`c.contract_date <= $${params.length}`) }
  const { rows } = await db.query(`
    SELECT c.id, c.contract_no, c.project_name, c.tender_name, c.contract_date,
           c.currency_code, c.exchange_rate, c.amount_after_vat,
           c.customer_id, cu.code AS customer_code, cu.name AS customer_name
      FROM contract_out c
      LEFT JOIN customer cu ON cu.id = c.customer_id
     WHERE ${cond.join(' AND ')}
     ORDER BY c.id`, params)
  return rows
}

// Đợt phải trả NCC + ngữ cảnh hợp đồng nhập + NCC.
export async function loadPayables(db = pool, { asOf, pit } = {}) {
  if (pit && asOf) return loadPayablesAsOf(asOf, db)
  const { rows } = await db.query(`
    SELECT pa.id, pa.contract_in_id, pa.description, pa.amount, pa.currency_code, pa.exchange_rate,
           pa.amount_vnd, pa.due_date,
           ci.contract_no, ci.contract_date, ci.contract_out_id,
           s.code AS supplier_code, s.name AS supplier_name
      FROM contract_in_payable pa
      JOIN contract_in ci ON ci.id = pa.contract_in_id
      LEFT JOIN supplier s ON s.id = ci.supplier_id
     ORDER BY ci.id, pa.due_date NULLS LAST, pa.id`)
  return rows
}

// Thanh toán NCC theo từng hợp đồng nhập (cấp HĐ, không gắn từng đợt).
// asOf (tùy chọn): chỉ lấy khoản trả có ngày ≤ asOf.
export async function loadPaymentsByContractIn(db = pool, { asOf } = {}) {
  const { rows } = await db.query(`
    SELECT contract_in_id, id, amount, currency_code, exchange_rate, amount_vnd, payment_date
      FROM contract_in_payment
     WHERE ($1::date IS NULL OR payment_date <= $1::date)
     ORDER BY contract_in_id, payment_date NULLS LAST, id`, [asOf || null])
  return groupBy(rows, 'contract_in_id')
}

// Map(contract_out_id(string) → tổng đã xuất hóa đơn quy VND).
// asOf (tùy chọn): chỉ tính hóa đơn xuất ngày ≤ asOf.
export async function loadInvoicedByContract(db = pool, { asOf, pit } = {}) {
  if (pit && asOf) return loadInvoicedByContractAsOf(asOf, db)
  const { rows } = await db.query(`
    SELECT i.contract_out_id,
           SUM(CASE WHEN i.currency_code = 'VND' THEN it.amount_after_vat
                    ELSE it.amount_after_vat * COALESCE(i.exchange_rate, 1) END) AS invoiced_vnd
      FROM contract_out_invoice i
      JOIN contract_out_invoice_item it ON it.invoice_id = i.id
     WHERE ($1::date IS NULL OR i.invoice_date <= $1::date)
     GROUP BY i.contract_out_id`, [asOf || null])
  const map = new Map()
  for (const r of rows) map.set(String(r.contract_out_id), parseFloat(r.invoiced_vnd) || 0)
  return map
}

// Doanh thu đã xuất hóa đơn của 1 năm (quy VND) — theo ngày xuất.
// asOf (tùy chọn): chỉ cộng hóa đơn xuất ngày ≤ asOf (lũy kế tới thời điểm xem).
export async function revenueOfYear(year, db = pool, asOf = null, pit = false) {
  if (pit && asOf) return revenueOfYearAsOf(year, asOf, db)
  const { rows } = await db.query(`
    SELECT COALESCE(SUM(CASE WHEN i.currency_code = 'VND' THEN it.amount_after_vat
                             ELSE it.amount_after_vat * COALESCE(i.exchange_rate, 1) END), 0) AS v
      FROM contract_out_invoice i
      JOIN contract_out_invoice_item it ON it.invoice_id = i.id
     WHERE EXTRACT(YEAR FROM i.invoice_date) = $1
       AND ($2::date IS NULL OR i.invoice_date <= $2::date)`, [Number(year), asOf || null])
  return parseFloat(rows[0].v) || 0
}

function groupBy(rows, key) {
  const map = new Map()
  for (const r of rows) {
    const k = String(r[key])
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
}
