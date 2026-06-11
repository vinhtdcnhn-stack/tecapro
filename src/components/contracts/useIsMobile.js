import { useState, useEffect } from 'react'

// True khi màn hình ≤ maxWidth (mặc định 768px — đồng bộ breakpoint mobile của app).
// Dùng để rẽ nhánh render desktop (bảng inline) ↔ mobile (thẻ + sheet sửa).
export default function useIsMobile(maxWidth = 768) {
  const query = `(max-width: ${maxWidth}px)`
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return isMobile
}
