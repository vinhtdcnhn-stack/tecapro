import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { sendTelegramMessage } from '../services/telegram.js'
import { AUTH_COOKIE, revokeToken } from '../auth/token.js'
import { parseCookies } from '../middleware/auth.js'
import { loginLimiter } from '../middleware/loginRateLimit.js'
import { loadGlobalPermissions } from '../auth/permissions.js'
import { DUMMY_HASH, setAuthCookie } from './authShared.js'
import { getUserById } from './userController.js'

// ==================== AUTH CONTROLLER ====================
// Phiên đăng nhập (login/logout/me). Hồ sơ người dùng nằm ở userController.js,
// danh mục phòng ban/chức danh/quản lý ở orgController.js — routes/index.js vẫn import
// qua file này nhờ phần re-export ở cuối.

export async function login(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
    return
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.password_hash, u.telegram_chat_id,
       u.token_version, u.is_active, u.department_id, d.code AS department_code, d.name AS department_name,
       COALESCE((
         SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name) ORDER BY p.id)
         FROM app_user_position up JOIN position p ON p.id = up.position_id
         WHERE up.user_id = u.id
       ), '[]') AS positions,
       EXISTS(SELECT 1 FROM contract_out_member m WHERE m.user_id = u.id) AS has_projects
     FROM app_user u
     LEFT JOIN department d ON d.id = u.department_id
     WHERE u.email = $1`,
    [email],
  )
  const user = rows[0]
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH) // cân bằng timing với nhánh có user
    loginLimiter.fail(req)
    res.status(401).json({ error: 'Sai email hoặc mật khẩu.' })
    return
  }

  if (!user.password_hash) {
    console.error('Lỗi: User không có password_hash')
    res.status(500).json({ error: 'Lỗi hệ thống: User không có mật khẩu.' })
    return
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    loginLimiter.fail(req)
    res.status(401).json({ error: 'Sai email hoặc mật khẩu.' })
    return
  }

  // Nhân sự đã nghỉ việc: tài khoản KHÔNG bị xóa (dữ liệu quá khứ còn nguyên) nhưng không
  // đăng nhập được nữa. Kiểm tra SAU khi so mật khẩu để không lộ tài khoản nào tồn tại.
  if (user.is_active === false) {
    res.status(403).json({ error: 'Tài khoản đã ngừng hoạt động. Vui lòng liên hệ quản trị viên.' })
    return
  }

  if (user.telegram_chat_id) {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    sendTelegramMessage(
      user.telegram_chat_id,
      `🔐 Tài khoản của bạn vừa đăng nhập vào hệ thống TECAPRO lúc ${now}.`,
    )
  }

  setAuthCookie(res, user)

  const positions = user.positions || []
  const permissions = await loadGlobalPermissions(user.id, user.role)
  res.json({
    id:              user.id,
    email:           user.email,
    full_name:       user.full_name,
    role:            user.role,
    department_id:   user.department_id   || null,
    department_code: user.department_code || null,
    department_name: user.department_name || null,
    positions,
    position_code:   positions[0]?.code  || null,
    position_name:   positions.map(p => p.name).join(', ') || null,
    telegram_chat_id: user.telegram_chat_id || null,
    has_projects:    user.has_projects,
    permissions,
  })
}

export function logout(req, res) {
  // Thu hồi token phía server (denylist) ngoài việc xoá cookie, để token bị lộ không tái dùng được.
  const token = parseCookies(req)[AUTH_COOKIE]
  if (token) revokeToken(token)
  res.clearCookie(AUTH_COOKIE, { path: '/' })
  res.json({ success: true })
}

// Trả thông tin người dùng đang đăng nhập, lấy danh tính từ cookie (req.user) — không nhận id từ client.
export async function getCurrentUser(req, res) {
  req.params.id = req.user.id
  return getUserById(req, res)
}

// ---- Re-export để mọi call-site cũ (routes/index.js) không phải sửa ----
export {
  createUser, updateUser, getAllUsers, getUserById, changePassword,
  updateMyTelegram, testTelegram,
  checkEmailExists, checkUsernameExists, checkEmployeeCodeExists,
} from './userController.js'
export {
  getAllDepartments, createDepartment, updateDepartment,
  getAllPositions, createPosition, updatePosition,
  getAllManagers,
} from './orgController.js'
