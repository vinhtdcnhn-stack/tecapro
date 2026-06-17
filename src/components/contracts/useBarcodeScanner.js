import { useEffect, useRef, useState } from 'react'

// ── Bắt luồng bắn của máy scan barcode ở cấp window (capture phase) ──────────────
// Máy scan HID hành xử như bàn phím: gõ rất nhanh dãy ký tự rồi gửi một phím "đuôi"
// (suffix) — thường là Enter, nhưng có thể kèm Tab / Enter thứ 2 / ký tự điều khiển
// (GS/RS/FNC1 trong mã 2D) bị wedge map thành tổ hợp như Ctrl+Esc. Nếu chỉ bắt Enter
// trên một ô input, phím đuôi đó lọt xuống Windows và mở app khác.
//
// Hook này nghe keydown ở window (capture) khi `active`, gom ký tự in được vào buffer,
// commit qua onSerial khi gặp Enter, và NUỐT (preventDefault) mọi phím lạ/đuôi/điều
// khiển đến trong một "burst" (gõ liền nhau < BURST_MS) để không phím nào rò ra ngoài.
// Phím tắt người dùng bấm bằng tay (gap lớn) như Ctrl+S vẫn được cho đi qua.

const BURST_MS = 100

export function useBarcodeScanner({ active, onSerial }) {
  const [buffer, setBuffer] = useState('')
  const bufferRef  = useRef('')
  const lastTimeRef = useRef(0)
  const onSerialRef = useRef(onSerial)
  useEffect(() => { onSerialRef.current = onSerial }, [onSerial])

  // Cho phép cập nhật buffer từ bên ngoài (vd onChange khi DÁN vào ô input).
  const setBufferExternal = (v) => { bufferRef.current = v; setBuffer(v) }

  useEffect(() => {
    if (!active) return
    function handler(e) {
      const now = Date.now()
      const gap = now - lastTimeRef.current
      lastTimeRef.current = now
      const burst = gap < BURST_MS  // phím đến liền sau phím trước → do máy scan bắn

      if (e.key === 'Enter') {
        const serial = bufferRef.current.trim()
        bufferRef.current = ''
        setBuffer('')
        e.preventDefault()
        e.stopPropagation()
        if (serial) onSerialRef.current(serial)
        return
      }

      // Ký tự in được: nối vào buffer; tự quản lý hiển thị nên chặn hành vi mặc định.
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key
        setBuffer(bufferRef.current)
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Phím không-nhập-liệu / tổ hợp: chỉ nuốt khi nằm trong burst (đuôi của máy scan).
      // Người dùng bấm tay (gap lớn) như Ctrl+S, Escape… được cho qua bình thường.
      if (burst) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [active])

  return { buffer, setBufferExternal }
}
