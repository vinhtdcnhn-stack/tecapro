import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import './BarcodeScanner.css'

// Các định dạng cần đọc (1D công nghiệp + 2D phổ biến).
const FORMATS = [
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.ITF, BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
]

// "Cố gắng hơn" — chậm hơn chút nhưng đọc tốt mã 1D dày/mờ như nhãn thiết bị.
const HINTS = new Map()
HINTS.set(DecodeHintType.TRY_HARDER, true)
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS)

// Overlay quét barcode bằng camera. onDetected(text) khi đọc được mã; onClose() để đóng.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const trackRef = useRef(null)
  const doneRef = useRef(false)
  const [error, setError] = useState('')
  const [canTorch, setCanTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 120 })
    let cancelled = false

    reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current,
        (result, _err, controls) => {
          controlsRef.current = controls
          if (cancelled || doneRef.current || !result) return
          doneRef.current = true
          controls.stop()
          onDetected(result.getText())
        }
      )
      .then(controls => {
        controlsRef.current = controls
        // Kiểm tra hỗ trợ đèn flash (torch) — đa số chỉ có trên Android.
        const track = videoRef.current?.srcObject?.getVideoTracks?.()[0]
        trackRef.current = track
        if (track?.getCapabilities?.().torch) setCanTorch(true)
      })
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

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch { /* thiết bị không cho bật đèn */ }
  }

  return (
    <div className="bs-overlay" role="dialog" aria-modal="true">
      <div className="bs-frame">
        <video ref={videoRef} className="bs-video" muted playsInline />
        {!error && (
          <>
            <div className="bs-reticle" />
            <p className="bs-hint">Đưa mã vào khung, giữ máy cách ~10–15cm cho nét. Mã bị lóa thì bật đèn hoặc nghiêng nhẹ.</p>
          </>
        )}
        {error && <div className="bs-error">{error}</div>}
        {canTorch && !error && (
          <button className={`bs-torch${torchOn ? ' on' : ''}`} onClick={toggleTorch}>
            {torchOn ? '🔦 Tắt đèn' : '🔦 Bật đèn'}
          </button>
        )}
        <button className="bs-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
    </div>
  )
}
