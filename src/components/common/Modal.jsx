import { useEffect, useRef } from 'react'

/**
 * Modal dùng chung — xử lý sẵn các hành vi chuẩn:
 *  - Bấm nền tối (overlay) để đóng
 *  - Nhấn ESC để đóng
 *  - Focus-trap: giữ phím Tab quẩn bên trong modal, tự focus phần tử đầu khi mở,
 *    trả con trỏ về chỗ cũ khi đóng
 *  - Khóa cuộn trang nền khi modal mở
 *  - role/aria cho trình đọc màn hình
 *
 * Nội dung modal (header/body/footer) truyền qua children, dùng lại các class
 * .modal-header / .modal-body / .modal-footer sẵn có trong App.css.
 */
const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export default function Modal({
  isOpen = true,
  onClose,
  children,
  className = '',
  overlayClassName = 'modal-overlay',
  contentClassName = 'modal',
  width,
  labelledBy,
  closeOnOverlay = true,
}) {
  const modalRef = useRef(null)
  const prevFocusRef = useRef(null)
  // Giữ onClose mới nhất trong ref để effect không phải phụ thuộc vào nó.
  // (onClose thường là arrow function inline, tạo mới mỗi render — nếu đưa vào
  // deps thì mỗi lần gõ phím sẽ làm effect chạy lại và focus nhảy về nút đầu.)
  const onCloseRef = useRef(onClose)
  // Cập nhật ref sau mỗi render (không ghi ref trong thân render). Effect không deps →
  // chạy sau mọi render; handler keydown/overlay đọc onCloseRef.current ở thời điểm sự kiện.
  useEffect(() => { onCloseRef.current = onClose })

  // Effect này CHỈ phụ thuộc isOpen → chạy đúng một lần khi mở, không lặp lại
  // theo mỗi lần render (mỗi ký tự gõ vào).
  useEffect(() => {
    if (!isOpen) return

    // Nhớ phần tử đang focus để trả lại khi đóng
    prevFocusRef.current = document.activeElement

    // Khóa cuộn trang nền
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus phần tử focusable đầu tiên trong modal
    const el = modalRef.current
    if (el) {
      const focusables = el.querySelectorAll(FOCUSABLE)
      if (focusables.length) focusables[0].focus()
      else el.focus()
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Focus-trap
      const root = modalRef.current
      if (!root) return
      const focusables = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = prevOverflow
      // Trả con trỏ về phần tử trước khi mở modal
      if (prevFocusRef.current && prevFocusRef.current.focus) {
        prevFocusRef.current.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={overlayClassName}
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm đúng vào nền tối, không phải bên trong modal
        if (closeOnOverlay && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className={`${contentClassName} ${className}`.trim()}
        style={width ? { width, maxWidth: '95vw' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
