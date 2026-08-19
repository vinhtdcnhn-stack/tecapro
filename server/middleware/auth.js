import { verifyToken, AUTH_COOKIE } from '../auth/token.js'
import { pool } from '../db.js'

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
// Đối chiếu DB mỗi request: role lấy giá trị MỚI NHẤT (đổi quyền có hiệu lực ngay,
// không chờ token hết hạn), token_version phải khớp claim `tv` (đổi mật khẩu bump
// version → mọi token cũ bị từ chối). Token cũ chưa có `tv` được coi là 0. Tài khoản bị
// khóa (is_active = false) cũng bị chặn ngay tại đây, không chờ token hết hạn.
export async function requireAuth(req, res, next) {
  const payload = verifyToken(readToken(req))
  if (!payload) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' })
    return
  }
  let rows
  try {
    ({ rows } = await pool.query(
      'SELECT role, token_version, is_active FROM app_user WHERE id = $1',
      [payload.uid],
    ))
  } catch (err) {
    // Lỗi kết nối DB nhất thời (vd Connection terminated) → báo gọn, không sập tiến trình.
    console.error('[auth] Truy vấn phiên lỗi DB:', err.message)
    res.status(503).json({ error: 'Hệ thống tạm thời gián đoạn kết nối, vui lòng thử lại.' })
    return
  }
  const user = rows[0]
  if (!user || Number(payload.tv ?? 0) !== Number(user.token_version)) {
    res.status(401).json({ error: 'Phiên không còn hiệu lực. Vui lòng đăng nhập lại.' })
    return
  }
  // Nhân sự đã nghỉ việc (is_active = false): KHÔNG xóa tài khoản (dữ liệu quá khứ vẫn phải
  // truy được), nhưng phiên đang mở phải rụng ngay ở request kế tiếp.
  if (user.is_active === false) {
    res.status(401).json({ error: 'Tài khoản đã ngừng hoạt động. Vui lòng liên hệ quản trị viên.' })
    return
  }
  req.user = { id: payload.uid, role: user.role }
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
