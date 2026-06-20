import { useState, useRef, useEffect } from 'react'
import DateInput from '../../components/contracts/DateInput.jsx'
import { fmtDate } from '../accounting/reportUtils.js'

// Nút "xem dashboard tại 1 thời điểm" (asOf). KHÔNG lưu local — chỉ dùng cho phiên xem.
// asOf = null → đang xem hiện tại. Chọn ngày quá khứ → mọi số liệu tính tới ngày đó.
export default function DashAsOfPicker({ asOf, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const active = !!asOf

  return (
    <div className="dash-range" ref={ref}>
      <button
        type="button"
        className={`dash-range-btn${active ? ' dash-range-btn--active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span aria-hidden="true">🕐</span>
        <span>{active ? `Tại ngày ${fmtDate(asOf)}` : 'Xem tại 1 thời điểm'}</span>
        <span className="dash-range-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="dash-range-pop">
          <label className="dash-range-row dash-range-row--col">
            <span>Xem số liệu tính đến ngày</span>
            <DateInput value={asOf || ''} onChange={e => onChange(e.target.value || null)} />
          </label>
          <button
            type="button" className="dash-range-reset"
            onClick={() => { onChange(null); setOpen(false) }}
            disabled={!active}
          >
            Về hiện tại
          </button>
        </div>
      )}
    </div>
  )
}
