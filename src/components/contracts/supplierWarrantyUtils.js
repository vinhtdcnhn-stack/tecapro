// Shared constants, formatters & style helpers for the supplier-warranty tab.

export const CLAIM_STATUSES = ['Tiếp nhận', 'Đang xử lý', 'Đã giải quyết', 'Từ chối']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

export const fmtDateInput = (d) => {
  if (!d) return ''
  const s = typeof d === 'string' ? d : new Date(d).toISOString()
  return s.slice(0, 10)
}

export function claimStatusStyle(s) {
  if (s === 'Đã giải quyết') return { background: '#dcfce7', color: '#15803d' }
  if (s === 'Từ chối')       return { background: '#fee2e2', color: '#b91c1c' }
  if (s === 'Đang xử lý')   return { background: '#dbeafe', color: '#1d4ed8' }
  return { background: '#f3f4f6', color: '#6b7280' }
}

export function warrantyExpiry(row) {
  if (!row.warranty_end) return null
  const daysLeft = Math.ceil((new Date(row.warranty_end) - new Date()) / 86400000)
  if (daysLeft < 0)   return { label: 'Hết hạn', bg: '#fee2e2', color: '#b91c1c' }
  if (daysLeft <= 30) return { label: `Còn ${daysLeft} ngày`, bg: '#fef9c3', color: '#a16207' }
  return { label: `Còn ${daysLeft} ngày`, bg: '#dcfce7', color: '#15803d' }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

export function th(w, align = 'left') {
  return {
    padding: '8px 12px', textAlign: align, fontSize: 11, fontWeight: 600,
    color: '#4b5563', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
    ...(w ? { width: w, minWidth: w } : {}),
  }
}

export function td(align = 'left', extra = {}) {
  return { padding: '9px 12px', textAlign: align, borderBottom: '1px solid #f3f4f6', fontSize: 13, verticalAlign: 'middle', ...extra }
}

export const inputStyle = {
  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
}
