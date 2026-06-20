import { useState, useRef, useEffect } from 'react'

// Nút chọn khoảng thời gian (theo năm ký HĐ) cho dashboard điều hành.
// Bấm → mở popover gồm 2 ô chọn năm (từ → đến). Thay đổi gọi onChange({fromYear,toYear}).
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

  const nowYear = new Date().getFullYear()
  const years = []
  for (let y = nowYear; y >= nowYear - 10; y--) years.push(y)

  const setFrom = (fy) => onChange({ fromYear: fy, toYear: Math.max(fy, range.toYear) })
  const setTo = (ty) => onChange({ fromYear: Math.min(range.fromYear, ty), toYear: ty })

  const label = range.fromYear === range.toYear
    ? `Năm ${range.fromYear}` : `${range.fromYear} – ${range.toYear}`

  return (
    <div className="dash-range" ref={ref}>
      <button type="button" className="dash-range-btn" onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">📅</span>
        <span>{label}</span>
        <span className="dash-range-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dash-range-pop">
          <label className="dash-range-row">
            <span>Từ năm</span>
            <select value={range.fromYear} onChange={e => setFrom(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="dash-range-row">
            <span>Đến năm</span>
            <select value={range.toYear} onChange={e => setTo(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button
            type="button" className="dash-range-reset"
            onClick={() => onChange({ fromYear: nowYear - 2, toYear: nowYear })}
          >
            Mặc định (3 năm gần nhất)
          </button>
        </div>
      )}
    </div>
  )
}
