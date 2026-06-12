// Security headers tổng thể (thay cho helmet — tránh thêm dependency).
// Áp cho MỌI response Express phục vụ (API + SPA dist + file).
//
// Phân tầng theo môi trường:
//   - nosniff + Referrer-Policy: bật MỌI lúc (an toàn tuyệt đối, không phụ thuộc origin).
//   - X-Frame-Options + CSP: chỉ bật ở production. Ở dev frontend chạy trên Vite
//     (origin :5173) còn API/file ở Express (:5174) → preview file nhúng iframe là
//     CROSS-origin; nếu áp frame-ancestors/SAMEORIGIN sẽ chặn nhầm preview lúc dev.
//     Production phục vụ SPA từ /dist cùng origin với API nên không vướng.
//
// CSP được nới đúng những chỗ app thật sự cần (đã rà soát source):
//   - style-src 'unsafe-inline': app dùng nhiều style={{...}} inline khắp components.
//   - script-src 'wasm-unsafe-eval' + worker-src blob: zxing-wasm (quét mã vạch) khởi
//     tạo WebAssembly và có thể chạy trong worker/blob; file .wasm bundle cục bộ ('self').
//   - frame-src/img-src 'self' (+ data:/blob:): preview PDF/ảnh qua /api/files/:id/view
//     cùng origin ở production.
//   - frame-ancestors 'self': cho chính app nhúng iframe preview, vẫn chống clickjacking
//     từ site ngoài (vì vậy KHÔNG dùng 'none'/DENY — sẽ chặn cả iframe của chính mình).
// CSP chặt hơn (loại 'unsafe-inline', tách script theo hash/nonce) nên đặt ở nginx về sau.

const CSP_PROD = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
].join('; ')

export function securityHeaders(_req, res, next) {
  // Luôn bật (không phụ thuộc origin/môi trường)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Content-Security-Policy', CSP_PROD)
  }
  next()
}
