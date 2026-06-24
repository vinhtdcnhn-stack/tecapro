import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../contracts/TaskContextMenu.css'

// ── Menu chuột phải dùng chung ──────────────────────────────────────────────────
// Hiện ở vị trí con trỏ với danh sách mục tuỳ ý. Đóng khi click ra ngoài / cuộn / ESC.
// Dùng position:fixed nên hoạt động cả trong khung cuộn/toàn màn hình.
//   menu : { x, y, title? } | null
//   items: [{ key?, label, danger?, disabled?, onClick }]  (onClick async được; menu tự đóng sau khi gọi)
//   onClose()
export default function ContextMenu({ menu, items = [], onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Giữ menu nằm trọn trong khung nhìn (lật lại nếu tràn mép phải/đáy).
  useLayoutEffect(() => {
    if (!menu) return
    const el = ref.current
    const w = el?.offsetWidth || 200
    const h = el?.offsetHeight || 80
    const pad = 8
    const x = Math.min(menu.x, window.innerWidth - w - pad)
    const y = Math.min(menu.y, window.innerHeight - h - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => onClose()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu) return null

  const handleClick = (item) => {
    onClose()
    item.onClick?.(menu)
  }

  return (
    <div
      ref={ref}
      className="task-ctxmenu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.title && <div className="task-ctxmenu-title" title={menu.title}>{menu.title}</div>}
      {items.map((it, i) => (
        <button
          key={it.key ?? i}
          type="button"
          className={`task-ctxmenu-item${it.danger ? ' danger' : ''}`}
          disabled={it.disabled}
          onClick={() => handleClick(it)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
