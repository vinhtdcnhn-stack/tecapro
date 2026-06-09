import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import './BarcodeScanner.css'

// Overlay quét barcode bằng camera (đa định dạng: Code128/39/93, EAN/UPC, ITF,
// Codabar, QR, DataMatrix, Aztec, PDF417...). Ưu tiên camera sau trên điện thoại.
// onDetected(text): gọi khi đọc được mã. onClose(): đóng overlay.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const doneRef = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, _err, controls) => {
          controlsRef.current = controls
          if (cancelled || doneRef.current || !result) return
          doneRef.current = true
          controls.stop()
          onDetected(result.getText())
        }
      )
      .then(controls => { controlsRef.current = controls })
      .catch(err => {
        if (cancelled) return
        if (err?.name === 'NotAllowedError') setError('Bạn chưa cho phép truy cập camera. Hãy cấp quyền rồi thử lại.')
        else if (err?.name === 'NotFoundError') setError('Không tìm thấy camera trên thiết bị.')
        else setError('Không mở được camera: ' + (err?.message || 'lỗi không xác định'))
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDetected])

  return (
    <div className="bs-overlay" role="dialog" aria-modal="true">
      <div className="bs-frame">
        <video ref={videoRef} className="bs-video" muted playsInline />
        {!error && (
          <>
            <div className="bs-reticle" />
            <p className="bs-hint">Đưa mã vạch / QR của thiết bị vào khung</p>
          </>
        )}
        {error && <div className="bs-error">{error}</div>}
        <button className="bs-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
    </div>
  )
}
