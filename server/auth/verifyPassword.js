import bcrypt from 'bcryptjs'
import { pool } from '../db.js'

// Xác thực lại mật khẩu của CHÍNH user đang đăng nhập (dùng cho thao tác nhạy cảm như
// mở khóa đợt). Trả true nếu khớp, false nếu sai/không có hash. Luôn chạy bcrypt.compare
// (kể cả khi password rỗng) để controller chỉ cần kiểm tra boolean.
export async function verifyUserPassword(userId, password) {
  const { rows } = await pool.query('SELECT password_hash FROM app_user WHERE id = $1', [userId])
  const hash = rows[0]?.password_hash
  if (!hash) return false
  return bcrypt.compare(String(password ?? ''), hash)
}
