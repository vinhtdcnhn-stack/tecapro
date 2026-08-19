import bcrypt from 'bcryptjs'
import { signToken, AUTH_COOKIE, TOKEN_MAX_AGE_SEC } from '../auth/token.js'

// Hằng số + tiện ích dùng chung cho 3 controller tách ra từ authController cũ:
// authController (phiên đăng nhập) / userController (hồ sơ người dùng) / orgController
// (danh mục phòng ban, chức danh, quản lý).

// TTL danh mục ít đổi. Đổi user/phòng/vị trí đã invalidate ngay nên TTL dài là an toàn.
const USERS_TTL = 6 * 60 * 60        // 6h
const LOOKUP_TTL = 24 * 60 * 60      // 24h (departments/positions rất ổn định)

// Số vòng bcrypt khi băm mật khẩu. Mật khẩu cũ băm ở cost thấp hơn vẫn xác thực
// bình thường (cost được nhúng trong hash); chỉ hash mới dùng cost này.
const BCRYPT_ROUNDS = 12

// Hash mồi cho login khi email không tồn tại: vẫn chạy bcrypt.compare để hai nhánh
// (có user / không có user) tốn thời gian như nhau — chống dò email qua timing.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-dummy', BCRYPT_ROUNDS)

// Độ dài tối thiểu khi ĐẶT mật khẩu mới (create/update/change-password).
// Mật khẩu cũ ngắn hơn vẫn đăng nhập được — chỉ chặn khi đặt mới.
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_TOO_SHORT = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`

// Đặt cookie phiên httpOnly (không đọc được từ JS phía client).
// Claim `tv` (token_version) phải khớp DB khi verify — đổi mật khẩu bump version
// để vô hiệu mọi token cũ (xem requireAuth).
function setAuthCookie(res, user) {
  const token = signToken({ uid: user.id, role: user.role, tv: Number(user.token_version ?? 0) })
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_MAX_AGE_SEC * 1000,
    path: '/',
  })
}

export {
  USERS_TTL, LOOKUP_TTL, BCRYPT_ROUNDS, DUMMY_HASH,
  PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT, setAuthCookie,
}
