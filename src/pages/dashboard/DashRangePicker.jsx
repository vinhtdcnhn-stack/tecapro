import { useState, useRef, useEffect } from 'react'
import DateInput from '../../components/contracts/DateInput.jsx'
import { fmtDate } from '../accounting/reportUtils.js'
import { defaultDashRange } from './execUtils.js'

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Các khoảng chọn nhanh — bấm 1 phát ra khoảng ngày tương ứng.
function presets() {
  const now = new Date()
  const y = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3) // quý hiện tại (0..3)
  return [
    { key: 'thisMonth', label: 'Tháng này', range: { from: iso(new Date(y, now.getMonth(), 1)), to: iso(new Date(y, now.getMonth() + 1, 0)) } },
    { key: 'thisQuarter', label: 'Quý này', range: { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)) } },
    { key: 'ytd', label: 'Từ đầu năm', range: { from: `${y}-01-01`, to: iso(now) } },
    { key: 'thisYear', label: `Năm ${y}`, range: { from: `${y}-01-01`, to: `${y}-12-31` } },
    { key: 'lastYear', label: `Năm ${y - 1}`, range: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` } },
    { key: 'all', label: 'Toàn bộ', range: { from: '', to: '' } },
  ]
}

// Nhãn hiển thị trên nút: "01/01/2024 – 31/12/2026", "Từ 01/01/2024", "Toàn bộ thời gian"…
function rangeLabel({ from, to } = {}) {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`
  if (from) return `Từ ${fmtDate(from)}`
  if (to) return `Đến ${fmtDate(to)}`
  return 'Toàn bộ thời gian'
}

// Nút chọn khoảng thời gian (theo NGÀY ký HĐ) cho dashboard điều hành.
// Bấm → mở popover gồm 2 ô nhập ngày (từ → đến) + các khoảng chọn nhanh.
// Thay đổi gọi onChange({ from, to }) với ngày ISO 'yyyy-mm-dd' (rỗng = không giới hạn).
export default function DashRangePicker({ range, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Bấm ra ngoài → đóng popover.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const from = range?.from || ''
  const to = range?.to || ''
  // Nhập lệch (từ > đến) thì kéo đầu kia theo để khoảng luôn hợp lệ.
  const setFrom = (v) => onChange({ from: v, to: to && v && v > to ? v : to })
  const setTo = (v) => onChange({ from: from && v && v < from ? v : from, to: v })

  return (
    <div className="dash-range" ref={ref}>
      <button type="button" className="dash-range-btn" onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">📅</span>
        <span>{rangeLabel(range)}</span>
        <span className="dash-range-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dash-range-pop dash-range-pop--wide">
          <label className="dash-range-row">
            <span>Từ ngày</span>
            <DateInput value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="dash-range-row">
            <span>Đến ngày</span>
            <DateInput value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <div className="dash-range-presets">
            {presets().map(p => (
              <button
                key={p.key} type="button"
                className={`dash-range-chip${from === p.range.from && to === p.range.to ? ' dash-range-chip--on' : ''}`}
                onClick={() => onChange(p.range)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button" className="dash-range-reset"
            onClick={() => onChange(defaultDashRange())}
          >
            Mặc định (3 năm gần nhất)
          </button>
        </div>
      )}
    </div>
  )
}
