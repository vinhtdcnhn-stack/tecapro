export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY', 'GBP', 'AUD', 'KRW']

export const fmtVND = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
export const fmtAmt = (n, cur) => { const num = parseFloat(n) || 0; return cur === 'VND' ? fmtVND(num) : new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num) }

export function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

export function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

export const needsRate = (row) => {
  const cur = row.currency_code
  if (!cur || cur === 'VND') return false
  return !(parseFloat(row.exchange_rate) > 1)
}

let _ctr = 0
export const tmpId = () => `tmp_${++_ctr}`

export function RowActions({ row, onSave, onDelete }) {
  return (
    <div className="action-group">
      {row._dirty && (
        <button className="act save" onClick={() => onSave(row)} disabled={row._saving} title="Lưu">
          {row._saving
            ? <span className="spin">⟳</span>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          }
        </button>
      )}
      <button className="act delete" onClick={() => onDelete(row)} title="Xóa">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  )
}
