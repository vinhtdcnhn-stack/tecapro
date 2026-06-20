import { useEffect } from 'react'

// Overlay chi tiết phủ toàn màn hình. Đóng bằng Esc hoặc nút ×; khoá scroll nền khi mở.
export default function ExecCardModal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="exec-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="exec-modal-head">
        <div>
          <h2 className="exec-modal-title">{title}</h2>
          {subtitle && <p className="exec-modal-sub">{subtitle}</p>}
        </div>
        <button type="button" className="exec-modal-close" onClick={onClose} aria-label="Đóng">×</button>
      </header>
      <div className="exec-modal-body">{children}</div>
    </div>
  )
}
