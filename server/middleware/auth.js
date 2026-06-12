import { verifyToken, AUTH_COOKIE } from '../auth/token.js'

// Parse cookie thủ công (không phụ thuộc cookie-parser).
export function parseCookies(req) {
  const header = req.headers.cookie
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (!k) continue
    out[k] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

function readToken(req) {
  const cookies = parseCookies(req)
  if (cookies[AUTH_COOKIE]) return cookies[AUTH_COOKIE]
  const h = req.headers.authorization
  if (h && h.startsWith('Bearer ')) return h.slice(7)
  return null
}

// Bắt buộc đã đăng nhập. Gắn req.user = { id, role } lấy từ token đã xác thực.
export function requireAuth(req, res, next) {
  const payload = verifyToken(readToken(req))
  if (!payload) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' })
    return
  }
  req.user = { id: payload.uid, role: payload.role }
  next()
}

// Chỉ admin (role = 1).
export function requireAdmin(req, res, next) {
  if (Number(req.user?.role) !== 1) {
    res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' })
    return
  }
  next()
}

// Chính chủ (id trùng) hoặc admin.
export function requireSelfOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    if (Number(req.user?.role) === 1 || String(req.user?.id) === String(req.params[paramName])) {
      next()
      return
    }
    res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' })
  }
}
