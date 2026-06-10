import { useEffect, useRef } from 'react'

// Bắt Ctrl/Cmd + S để lưu nhanh tất cả dòng đang sửa của bảng hiện tại, đồng thời
// chặn hộp thoại "Lưu trang" mặc định của trình duyệt. Dùng ref để luôn gọi
// callback mới nhất mà không phải gắn lại listener mỗi lần render.
export default function useCtrlSave(onSave) {
  const ref = useRef(onSave)
  useEffect(() => { ref.current = onSave })  // cập nhật ref sau mỗi render (không ghi lúc render)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        ref.current?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
