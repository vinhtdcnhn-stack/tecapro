import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './TaskContextMenu.css'

// ── Menu chuột phải cho 1 công việc ─────────────────────────────────────────────
// Hiện ở vị trí con trỏ với mục "Sao chép thông tin". Đóng khi click ra ngoài / cuộn /
// nhấn ESC. Dùng position:fixed nên hoạt động cả trong khung Gantt toàn màn hình.
// menu: { x, y, task } | null · onCopy(task) · onClose()
// canTransfer (tùy chọn): true → hiện thêm mục "Chuyển việc"; onTransfer(task): mở hộp
// thoại chọn người để giao lại (tạo việc con). Bỏ trống cả hai → menu chỉ có Sao chép.
export default function TaskContextMenu({ menu, onCopy, onClose, canTransfer = false, onTransfer }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
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

  async function handleCopy() {
    const ok = await onCopy(menu.task)
    setCopied(ok)
    if (ok) setTimeout(onClose, 700)
    else onClose()
  }

  function handleTransfer() {
    onClose()
    onTransfer?.(menu.task)
  }

  return (
    <div
      ref={ref}
      className="task-ctxmenu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="task-ctxmenu-title" title={menu.task.title}>{menu.task.title}</div>
      <button type="button" className="task-ctxmenu-item" onClick={handleCopy}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/>
        </svg>
        {copied ? 'Đã sao chép ✓' : 'Sao chép thông tin'}
      </button>
      {canTransfer && onTransfer && (
        <button type="button" className="task-ctxmenu-item" onClick={handleTransfer}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 6l-1.41 1.41L16.17 9H8v2h8.17l-1.58 1.58L16 14l4-4-4-4zM4 18h8v-2H4V6h8V4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
          </svg>
          Chuyển việc
        </button>
      )}
    </div>
  )
}
