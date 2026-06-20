import { fmtMoney } from '../accounting/reportUtils.js'

// Quy đổi 1 giá trị nguyên tệ về VND (currency 'VND' → ×1). Theo Currency convention.
export const toVnd = (amount, rate, currency) => {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate) || 1
  return currency === 'VND' ? a : a * r
}

// Rút gọn số tiền VND cho dashboard điều hành: ≥1 tỷ → "12,5 tỷ"; ≥1 triệu → "850 triệu".
// Dưới 1 triệu thì hiện đầy đủ. Tooltip (title) luôn nên dùng fmtFull để xem số chính xác.
export const fmtCompact = (n) => {
  const v = parseFloat(n) || 0
  const abs = Math.abs(v)
  const trim = (x) => x.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  if (abs >= 1e9) return `${trim(v / 1e9)} tỷ`
  if (abs >= 1e6) return `${trim(v / 1e6)} triệu`
  return fmtMoney(v)
}

// Số tiền đầy đủ kèm "đ" — dùng cho tooltip.
export const fmtFull = (n) => `${fmtMoney(n)} đ`

// ── Khoảng thời gian (theo năm ký HĐ) cho dashboard điều hành — lưu localStorage ──
const DASH_RANGE_KEY = 'execDashRange'

// Ngầm định: năm hiện tại và 2 năm trước (vd 2024–2026).
export function defaultDashRange() {
  const y = new Date().getFullYear()
  return { fromYear: y - 2, toYear: y }
}

// Đọc khoảng đã lưu (lọc giá trị hợp lệ), trả về ngầm định nếu chưa có/hỏng.
export function loadDashRange() {
  try {
    const raw = JSON.parse(localStorage.getItem(DASH_RANGE_KEY))
    const f = Number(raw?.fromYear), t = Number(raw?.toYear)
    if (Number.isInteger(f) && Number.isInteger(t) && f <= t) return { fromYear: f, toYear: t }
  } catch { /* hỏng → ngầm định */ }
  return defaultDashRange()
}

export function saveDashRange(range) {
  try { localStorage.setItem(DASH_RANGE_KEY, JSON.stringify(range)) } catch { /* bỏ qua */ }
}

// Gộp khoảng năm + asOf thành query string cho API báo cáo.
// vd ?from=2024-01-01&to=2026-12-31&asOf=2025-06-30 (asOf = null → bỏ).
export function dashQuery({ fromYear, toYear } = {}, asOf = null) {
  const parts = []
  if (fromYear && toYear) parts.push(`from=${fromYear}-01-01`, `to=${toYear}-12-31`)
  if (asOf) parts.push(`asOf=${asOf}`)
  return parts.join('&')
}

// Lọc HĐ theo năm ký trong khoảng + (tùy chọn) chỉ giữ HĐ ký tới ngày asOf.
export function filterByRange(contracts = [], { fromYear, toYear } = {}, asOf = null) {
  return contracts.filter(c => {
    if (!c.contract_date) return false
    const d = String(c.contract_date).slice(0, 10)
    const y = Number(d.slice(0, 4))
    if (fromYear && toYear && (y < fromYear || y > toYear)) return false
    if (asOf && d > asOf) return false
    return true
  })
}

const STATUS_ORDER = ['Active', 'Pending', 'Completed', 'Draft', 'Cancelled']
const STATUS_LABEL = {
  Active: 'Đang thực hiện', Pending: 'Chờ xử lý', Completed: 'Hoàn thành',
  Draft: 'Nháp', Cancelled: 'Hủy bỏ',
}
const STATUS_BADGE = {
  Active: 'status-active', Pending: 'status-pending', Completed: 'status-completed',
  Cancelled: 'status-cancelled', Draft: '',
}

export const statusLabel = (s) => STATUS_LABEL[s] || s || '—'
export const statusBadge = (s) => STATUS_BADGE[s] || ''

// Badge cho trạng thái công nợ (debt-by-contract.status): tiếng Việt sẵn từ server.
export const debtStatusBadge = (s) =>
  s === 'Đã thanh toán' ? 'status-completed'
    : s === 'Quá hạn' ? 'status-cancelled'
      : s === 'Trong hạn' ? 'status-active' : ''

// Gom hợp đồng theo trạng thái: [{ status, label, badge, count, valueVnd }] (theo thứ tự ưu tiên).
export function groupByStatus(contracts = []) {
  const map = new Map()
  for (const c of contracts) {
    const key = c.status || 'Draft'
    const cur = map.get(key) || { count: 0, valueVnd: 0 }
    cur.count += 1
    cur.valueVnd += toVnd(c.amount_after_vat, c.exchange_rate, c.currency_code)
    map.set(key, cur)
  }
  const keys = [...map.keys()].sort(
    (a, b) => (STATUS_ORDER.indexOf(a) + 1 || 99) - (STATUS_ORDER.indexOf(b) + 1 || 99))
  return keys.map(k => ({
    status: k, label: statusLabel(k), badge: statusBadge(k),
    count: map.get(k).count, valueVnd: map.get(k).valueVnd,
  }))
}

// Giá trị HĐ ký theo tháng trong N tháng gần nhất (kể cả tháng hiện tại).
// → [{ key:'YYYY-MM', label:'MM/YY', valueVnd, count }], cũ → mới.
export function signedByMonth(contracts = [], n = 12) {
  const now = new Date()
  const buckets = []
  const index = new Map()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
    const b = { key, label, valueVnd: 0, count: 0 }
    buckets.push(b)
    index.set(key, b)
  }
  for (const c of contracts) {
    if (!c.contract_date) continue
    const key = String(c.contract_date).slice(0, 7)
    const b = index.get(key)
    if (!b) continue
    b.valueVnd += toVnd(c.amount_after_vat, c.exchange_rate, c.currency_code)
    b.count += 1
  }
  return buckets
}

// Tổng giá trị HĐ ký trong 1 năm (VND). year mặc định = năm hiện tại.
export function signedThisYearVnd(contracts = [], year = new Date().getFullYear()) {
  const y = String(year)
  return contracts.reduce((s, c) =>
    (c.contract_date && String(c.contract_date).slice(0, 4) === y)
      ? s + toVnd(c.amount_after_vat, c.exchange_rate, c.currency_code) : s, 0)
}

export function signedThisYearCount(contracts = [], year = new Date().getFullYear()) {
  const y = String(year)
  return contracts.filter(c => c.contract_date && String(c.contract_date).slice(0, 4) === y).length
}
