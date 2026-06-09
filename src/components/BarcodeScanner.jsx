import { useEffect, useRef, useState } from 'react'
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import './BarcodeScanner.css'

// Nạp file .wasm cục bộ (bundle cùng app) thay vì tải từ CDN → chạy được cả khi VPS offline.
prepareZXingModule({
  overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
})

// Định dạng cần đọc: 2D (Data Matrix/QR/Aztec/PDF417) + 1D công nghiệp/bán lẻ.
const ZXING_OPTS = {
  formats: ['DataMatrix', 'QRCode', 'Aztec', 'PDF417', 'MicroQRCode',
    'Code128', 'Code39', 'Code93', 'ITF', 'Codabar', 'EAN13', 'EAN8', 'UPCA', 'UPCE'],
  tryHarder: true,
  tryInvert: true,   // đọc cả mã khắc laser sáng-trên-nền-tối (vd nhãn Dell)
  tryRotate: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
}

const SCAN_INTERVAL_MS = 130

// Overlay quét barcode bằng camera. CHỈ giải mã vùng trong khung ngắm (ROI).
// Ưu tiên BarcodeDetector gốc của trình duyệt (nhanh, tốt trên Android), rồi tới
// zxing-wasm (mạnh với Data Matrix, chạy mọi nền tảng kể cả iOS).
// onDetected(text) khi đọc được mã; onClose() để đóng.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const reticleRef = useRef(null)
  const streamRef = useRef(null)
  const trackRef = useRef(null)
  const canvasRef = useRef(null)
  const nativeRef = useRef(null)
  const timerRef = useRef(0)
  const doneRef = useRef(false)
  const [error, setError] = useState('')
  const [canTorch, setCanTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
    let cancelled = false

    // Cắt đúng vùng khung ngắm từ video (đã tính object-fit: cover).
    function drawROI() {
      const video = videoRef.current, reticle = reticleRef.current, canvas = canvasRef.current
      if (!video || !reticle || !video.videoWidth) return null

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
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      return { canvas, ctx, w: cropW, h: cropH }
    }

    function finish(text) {
      if (cancelled || doneRef.current || !text) return
      doneRef.current = true
      onDetected(text)
    }

    async function tryDecode() {
      const roi = drawROI()
      if (!roi) return

      // 1) Bộ giải mã gốc của trình duyệt (Android Chrome…)
      if (nativeRef.current) {
        try {
          const codes = await nativeRef.current.detect(roi.canvas)
          if (codes && codes.length && codes[0].rawValue) return finish(codes[0].rawValue)
        } catch { /* bỏ qua, thử zxing-wasm */ }
      }

      // 2) zxing-wasm (mạnh với Data Matrix, chạy cả trên iOS)
      try {
        const imageData = roi.ctx.getImageData(0, 0, roi.w, roi.h)
        const results = await readBarcodes(imageData, ZXING_OPTS)
        const hit = results?.find(r => r.isValid && r.text)
        if (hit) return finish(hit.text)
      } catch { /* khung này chưa thấy mã */ }
    }

    async function loop() {
      if (cancelled || doneRef.current) return
      await tryDecode()
      if (!cancelled && !doneRef.current) timerRef.current = setTimeout(loop, SCAN_INTERVAL_MS)
    }

    async function start() {
      // BarcodeDetector gốc nếu có (không tồn tại trên iOS — sẽ dùng zxing-wasm)
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          const want = ['data_matrix', 'qr_code', 'aztec', 'pdf417', 'code_128', 'code_39',
            'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar']
          const formats = want.filter(f => supported.includes(f))
          if (formats.length) nativeRef.current = new window.BarcodeDetector({ formats })
        } catch { nativeRef.current = null }
      }

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
            <p className="bs-hint">Đưa trọn mã (mã vạch hoặc mã vuông) vào khung. Giữ cách ~10–15cm cho nét, lóa thì bật đèn hoặc nghiêng nhẹ.</p>
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
