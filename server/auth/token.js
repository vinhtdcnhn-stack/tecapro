import crypto from 'crypto'

// Token phiên đăng nhập ký bằng HMAC-SHA256 (không cần thư viện ngoài).
// Dạng: base64url(payload).base64url(chữ_ký). Payload gồm { uid, role, exp }.

// Ở production BẮT BUỘC phải có AUTH_SECRET — dừng ngay nếu thiếu để không
// vô tình ký token bằng secret mặc định ai cũng biết.
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[auth] AUTH_SECRET bắt buộc phải được đặt ở production. ' +
    'Tạo bằng: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" rồi đặt vào .env.',
  )
}
const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me'
if (!process.env.AUTH_SECRET) {
  console.warn(
    '[auth] AUTH_SECRET chưa được đặt — đang dùng secret mặc định KHÔNG an toàn. ' +
    'Hãy đặt AUTH_SECRET (chuỗi ngẫu nhiên dài) trong .env trước khi chạy production.',
  )
}

export const AUTH_COOKIE = 'tecapro_auth'
export const TOKEN_MAX_AGE_SEC = 7 * 24 * 3600 // 7 ngày

// Denylist token đã thu hồi (logout). Khoá = chữ ký token, giá trị = exp (giây) để tự dọn.
// Lưu trong tiến trình: mất khi restart và KHÔNG chia sẻ giữa nhiều instance — chấp nhận với
// app nội bộ. Đây là lớp phòng vệ thêm: cookie vốn httpOnly và đã bị xoá khi logout; denylist
// chặn token bị lộ tái sử dụng trên cùng instance cho tới khi nó hết hạn tự nhiên.
const revoked = new Map()

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function signToken(payload, maxAgeSec = TOKEN_MAX_AGE_SEC) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSec }
  const data = b64url(JSON.stringify(body))
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const data = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!data || !sig) return null

  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  if (revoked.has(sig)) return null // token đã logout/thu hồi

  let payload
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) } catch { return null }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

// Thu hồi một token (gọi khi logout). Chỉ thu hồi token còn hợp lệ; lưu tới khi nó hết hạn.
export function revokeToken(token) {
  const payload = verifyToken(token)
  if (!payload) return
  const sig = token.slice(token.indexOf('.') + 1)
  revoked.set(sig, payload.exp)
}

// Dọn các token đã hết hạn khỏi denylist mỗi giờ để tránh phình bộ nhớ.
setInterval(() => {
  const now = Math.floor(Date.now() / 1000)
  for (const [sig, exp] of revoked) if (exp < now) revoked.delete(sig)
}, 60 * 60 * 1000).unref()
