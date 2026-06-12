// Giới hạn số lần THẤT BẠI theo IP trong một cửa sổ thời gian (chống brute-force, vd login).
// Chỉ đếm khi gọi fail() → đăng nhập ĐÚNG không bị tính, tránh khoá nhầm cả văn phòng
// dùng chung 1 IP (NAT). Lưu trong bộ nhớ tiến trình — đủ cho 1 instance; nhiều instance
// cần store dùng chung (vd Redis) vì mỗi tiến trình giữ bộ đếm riêng.

const buckets = new Map()

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10, message } = {}) {
  const keyOf = (req) => req.ip || req.socket?.remoteAddress || 'unknown'

  // Middleware: chặn nếu IP đã vượt ngưỡng thất bại. KHÔNG tăng bộ đếm ở đây.
  const guard = (req, res, next) => {
    const entry = buckets.get(keyOf(req))
    if (entry && Date.now() <= entry.reset && entry.count >= max) {
      const retry = Math.ceil((entry.reset - Date.now()) / 1000)
      res.setHeader('Retry-After', String(retry))
      res.status(429).json({ error: message || `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retry} giây.` })
      return
    }
    next()
  }

  // Ghi nhận một lần thất bại (gọi từ controller khi sai thông tin đăng nhập).
  const fail = (req) => {
    const key = keyOf(req)
    const now = Date.now()
    let entry = buckets.get(key)
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs }
      buckets.set(key, entry)
    }
    entry.count++
  }

  return { guard, fail }
}

// Dọn các bucket đã hết hạn mỗi phút để tránh phình bộ nhớ.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k)
}, 60 * 1000).unref()
