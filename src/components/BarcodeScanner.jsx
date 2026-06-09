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

const SCAN_INTERVAL_MS = 90

// Overlay quét barcode bằng camera. CHỈ giải mã vùng bên trong khung ngắm (ROI)
// nên nhãn có nhiều mã thì người dùng căn riêng 1 mã vào khung là đọc đúng mã đó.
// onDetected(text) khi đọc được mã; onClose() để đóng.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const reticleRef = useRef(null)
  const streamRef = useRef(null)
  const trackRef = useRef(null)
  const canvasRef = useRef(null)
  const timerRef = useRef(0)
  const doneRef = useRef(false)
  const [error, setError] = useState('')
  const [canTorch, setCanTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(HINTS)
    canvasRef.current = document.createElement('canvas')
    let cancelled = false

    // Cắt đúng vùng khung ngắm từ video (đã tính object-fit: cover) rồi giải mã.
    function tryDecodeROI() {
      const video = videoRef.current, reticle = reticleRef.current, canvas = canvasRef.current
      if (!video || !reticle || !video.videoWidth) return false

      const vRect = video.getBoundingClientRect()
      const rRect = reticle.getBoundingClientRect()
      const vw = video.videoWidth, vh = video.videoHeight
      const scale = Math.max(vRect.width / vw, vRect.height / vh) // object-fit: cover
      const offX = (vw * scale - vRect.width) / 2
      const offY = (vh * scale - vRect.height) / 2

      let cropX = (rRect.left - vRect.left + offX) / scale
      let cropY = (rRect.top - vRect.top + offY) / scale
      let cropW = rRect.width / scale
      let cropH = rRect.height / scale
      cropX = Math.max(0, Math.min(cropX, vw - 1))
      cropY = Math.max(0, Math.min(cropY, vh - 1))
      cropW = Math.max(1, Math.min(cropW, vw - cropX))
      cropH = Math.max(1, Math.min(cropH, vh - cropY))

      canvas.width = cropW
      canvas.height = cropH
      canvas.getContext('2d').drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      try {
        const result = reader.decodeFromCanvas(canvas)
        if (result) { doneRef.current = true; onDetected(result.getText()); return true }
      } catch { /* khung này chưa thấy mã */ }
      return false
    }

    function loop() {
      if (cancelled || doneRef.current) return
      tryDecodeROI()
      if (!cancelled && !doneRef.current) timerRef.current = setTimeout(loop, SCAN_INTERVAL_MS)
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        if (track?.getCapabilities?.().torch) setCanTorch(true)
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        loop()
      } catch (err) {
        if (cancelled) return
        if (err?.name === 'NotAllowedError') setError('Bạn chưa cho phép truy cập camera. Hãy cấp quyền rồi thử lại.')
        else if (err?.name === 'NotFoundError') setError('Không tìm thấy camera trên thiết bị.')
        else setError('Không mở được camera: ' + (err?.message || 'lỗi không xác định'))
      }
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
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
            <div ref={reticleRef} className="bs-reticle" />
            <p className="bs-hint">Căn RIÊNG một mã vào khung (nhãn có nhiều mã thì chỉ để 1 mã trong khung). Giữ cách ~10–15cm cho nét, lóa thì bật đèn hoặc nghiêng nhẹ.</p>
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
