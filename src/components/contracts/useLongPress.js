import { useRef, useCallback } from 'react'

// Ấn giữ (long-press) cho thiết bị cảm ứng → gọi onLongPress(clientX, clientY).
// Trả về props để spread lên phần tử. Huỷ nếu nhấc tay sớm hoặc kéo lệch quá moveTol.
// Sau khi long-press đã kích hoạt, nuốt cú click kế tiếp để không mở/sửa nhầm.
export function useLongPress(onLongPress, { delay = 450, moveTol = 10 } = {}) {
  const timer = useRef(null)
  const startPos = useRef(null)
  const fired = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  const onTouchStart = useCallback((e) => {
    if (!onLongPress || e.touches?.length !== 1) return
    const t = e.touches[0]
    startPos.current = { x: t.clientX, y: t.clientY }
    fired.current = false
    clear()
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress(startPos.current.x, startPos.current.y)
    }, delay)
  }, [onLongPress, delay, clear])

  const onTouchMove = useCallback((e) => {
    const s = startPos.current
    const t = e.touches?.[0]
    if (!timer.current || !s || !t) return
    if (Math.abs(t.clientX - s.x) > moveTol || Math.abs(t.clientY - s.y) > moveTol) clear()
  }, [clear, moveTol])

  const onTouchEnd = useCallback(() => { clear() }, [clear])

  const onClickCapture = useCallback((e) => {
    if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false }
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd, onClickCapture }
}

// Biến thể cho danh sách render trong .map (không gọi được hook theo từng hàng):
// trả về factory getHandlers(payload) → bộ props cho 1 hàng. onLongPress(payload, x, y).
// Chỉ một chạm tại một thời điểm nên dùng chung một bộ ref.
export function useRowLongPress(onLongPress, { delay = 450, moveTol = 10 } = {}) {
  const timer = useRef(null)
  const startPos = useRef(null)
  const fired = useRef(false)

  return useCallback((payload) => ({
    onTouchStart: (e) => {
      if (!onLongPress || e.touches?.length !== 1) return
      const t = e.touches[0]
      startPos.current = { x: t.clientX, y: t.clientY }
      fired.current = false
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        fired.current = true
        onLongPress(payload, startPos.current.x, startPos.current.y)
      }, delay)
    },
    onTouchMove: (e) => {
      const s = startPos.current, t = e.touches?.[0]
      if (!timer.current || !s || !t) return
      if (Math.abs(t.clientX - s.x) > moveTol || Math.abs(t.clientY - s.y) > moveTol) {
        clearTimeout(timer.current); timer.current = null
      }
    },
    onTouchEnd: () => { clearTimeout(timer.current); timer.current = null },
    onClickCapture: (e) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false } },
  }), [onLongPress, delay, moveTol])
}
