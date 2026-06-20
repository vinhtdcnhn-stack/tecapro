// Tính hạn thu hiệu lực + tình trạng quá hạn cho các khoản phải thu — bản port của
// resolveDueDate (src/components/contracts/receivableUtils.js) + cách dựng bbDateMap
// trong ContractReceivableTab, để báo cáo/cảnh báo phía server dùng CHUNG một logic.
//
// 2 cơ sở (basis):
//   • 'actual' → hạn theo TIẾN ĐỘ THỰC: ngày thực tế của mốc (actual_date) hoặc dự
//                kiến (computeForecasts) — khớp đúng tab Phải thu.
//   • 'plan'   → hạn theo KẾ HOẠCH GỐC: ngày kế hoạch của mốc (planned_date).
import { computeForecasts } from './progressForecast.js'

const iso = (v) => (v ? String(v).slice(0, 10) : null)

const addDays = (isoDate, n) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Số ngày lịch giữa 2 mốc ISO (b - a).
export function diffDays(aISO, bISO) {
  if (!aISO || !bISO) return 0
  const [ay, am, ad] = aISO.slice(0, 10).split('-').map(Number)
  const [by, bm, bd] = bISO.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

// bb_type_id → ngày hiệu lực, theo basis. progressRows đã sort theo sort_order,id.
export function buildBbDateMap(progressRows, contractDate, basis) {
  const map = {}
  const forecasts = basis === 'actual' ? computeForecasts(progressRows, contractDate) : {}
  for (const r of progressRows) {
    const t = r.bb_type_id
    if (t == null || t === '') continue
    const key = String(t)
    if (key in map) continue
    const eff = basis === 'actual'
      ? (iso(r.actual_date) || forecasts[r.id] || null)
      : iso(r.planned_date)
    if (eff) map[key] = eff
  }
  return map
}

// Hạn thu hiệu lực của 1 khoản: neo HĐ / neo mốc biên bản / ngày nhập tay.
// Thiếu dữ liệu để suy động → fallback về due_date đã lưu.
export function resolveDueDate(row, bbDateMap, contractDate) {
  const offset = parseInt(row.due_offset_days, 10)
  const hasOffset = Number.isFinite(offset)
  if (row.due_base_anchor === 'contract') {
    return (contractDate && hasOffset) ? addDays(iso(contractDate), offset) : iso(row.due_date)
  }
  if (row.due_base_bb_type_id != null && row.due_base_bb_type_id !== '') {
    const base = bbDateMap[String(row.due_base_bb_type_id)]
    return (base && hasOffset) ? addDays(iso(base), offset) : iso(row.due_date)
  }
  return iso(row.due_date)
}

// Phân nhóm nợ theo số ngày quá hạn (theo file kế toán).
export function debtTier(daysOverdue) {
  if (daysOverdue <= 0) return null
  if (daysOverdue <= 7)  return '1-7'
  if (daysOverdue <= 15) return '8-15'
  if (daysOverdue <= 30) return '16-30'
  return '>30'
}

export const TIER_LABEL = {
  '1-7':  'Quá hạn 1-7 ngày',
  '8-15': 'Quá hạn 8-15 ngày',
  '16-30':'Quá hạn 16-30 ngày',
  '>30':  'Quá hạn >30 ngày',
}

// Vai trò (member_role) nhận thông báo theo từng cấp; cấp '>30' kèm BGĐ toàn hệ thống.
export const TIER_ROLES = {
  '1-7':  ['PM'],
  '8-15': ['PM', 'Accounting'],
  '16-30':['PM', 'Sale', 'Accounting'],
  '>30':  ['PM', 'Sale', 'Accounting'],
}
export const TIER_WITH_BGD = new Set(['>30'])

// Tính danh sách khoản phải thu kèm hạn hiệu lực + còn nợ + số ngày quá hạn.
//   receivables: [{...cột contract_receivable, contract_out_id, contract_date, paid, ...}]
//   progressByContract: Map(contract_out_id → progressRows[] đã sort)
//   basis: 'actual' | 'plan'; asOf: 'yyyy-mm-dd'
// Trả về mảng đã bổ sung: effective_due, remaining (nguyên tệ), days_overdue, tier.
export function computeReceivableDues(receivables, progressByContract, basis, asOf) {
  const bbCache = new Map()
  const out = []
  for (const r of receivables) {
    const cid = String(r.contract_out_id)
    if (!bbCache.has(cid)) {
      const prog = progressByContract.get(cid) || progressByContract.get(Number(cid)) || []
      bbCache.set(cid, buildBbDateMap(prog, iso(r.contract_date), basis))
    }
    const effDue = resolveDueDate(r, bbCache.get(cid), iso(r.contract_date))
    const amount = parseFloat(r.amount) || 0
    const paid   = parseFloat(r.paid) || 0
    const remaining = amount - paid
    const daysOverdue = (effDue && remaining > 0) ? diffDays(effDue, asOf) : 0
    out.push({
      ...r,
      effective_due: effDue,
      paid,
      remaining,
      days_overdue: daysOverdue,
      tier: debtTier(daysOverdue),
    })
  }
  return out
}
