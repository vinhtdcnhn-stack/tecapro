import { useState, useRef, useEffect } from 'react'

// Icon nhỏ đặt ngay trước lời chào để đổi nhanh giữa các bảng điều khiển.
// Trả về null khi user chỉ có 1 bảng (không cần chọn).
export default function DashSwitcher({ available, active, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!available || available.length <= 1) return null
  const current = available.find(a => a.key === active)

  return (
    <span className="dash-switcher-ic" ref={ref}>
      <button
        type="button"
        className="dash-switcher-btn"
        onClick={() => setOpen(o => !o)}
        title={current ? `Bảng: ${current.label}` : 'Chọn bảng điều khiển'}
        aria-label="Chọn bảng điều khiển"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      </button>
      {open && (
        <span className="dash-switcher-menu" role="menu">
          {available.map(a => (
            <button
              key={a.key}
              type="button"
              role="menuitemradio"
              aria-checked={active === a.key}
              className={active === a.key ? 'active' : ''}
              onClick={() => { onPick(a.key); setOpen(false) }}
            >
              {a.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
