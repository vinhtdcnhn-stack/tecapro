// Tiện ích chung cho theo dõi độ phủ nhập hàng ("đầu bán").

export const STATUS_META = {
  none:    { label: 'Chưa nhập',     cls: 'sc-none',    color: '#dc2626' },
  partial: { label: 'Nhập một phần', cls: 'sc-partial', color: '#d97706' },
  full:    { label: 'Đã đủ',         cls: 'sc-full',    color: '#16a34a' },
}

export function statusMeta(s) {
  return STATUS_META[s] || STATUS_META.none
}

export function fmtQty(n) {
  const v = Number(n) || 0
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

// % phủ theo SL (needed ≤ 0 → coi 100%).
export function pct(covered, needed) {
  const n = Number(needed) || 0
  if (n <= 0) return 100
  return Math.min(100, Math.round(((Number(covered) || 0) / n) * 100))
}
