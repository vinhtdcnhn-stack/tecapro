import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { sendTelegramMessage } from '../services/telegram.js'
import { signToken, AUTH_COOKIE, TOKEN_MAX_AGE_SEC, revokeToken } from '../auth/token.js'
import { parseCookies } from '../middleware/auth.js'
import { loginLimiter } from '../middleware/loginRateLimit.js'
import { logger } from '../utils/logger.js'

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

// ==================== AUTH CONTROLLER ====================

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

export async function login(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
    return
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.password_hash, u.telegram_chat_id,
       u.token_version, u.department_id, d.code AS department_code, d.name AS department_name,
       COALESCE((
         SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name) ORDER BY p.id)
         FROM app_user_position up JOIN position p ON p.id = up.position_id
         WHERE up.user_id = u.id
       ), '[]') AS positions
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

  if (user.telegram_chat_id) {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    sendTelegramMessage(
      user.telegram_chat_id,
      `🔐 Tài khoản của bạn vừa đăng nhập vào hệ thống TECAPRO lúc ${now}.`,
    )
  }

  setAuthCookie(res, user)

  const positions = user.positions || []
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

// ==================== USER CONTROLLER ====================

export async function createUser(req, res) {
  const {
    username,
    email,
    password,
    full_name,
    phone,
    employee_code,
    department_id,
    position_ids,
    manager_id,
    role
  } = req.body

  if (!username || !email || !password) {
    res.status(400).json({
      error: 'Thiếu dữ liệu.'
    })
    return
  }
  if (String(password).length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ error: PASSWORD_TOO_SHORT })
    return
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const posIds = Array.isArray(position_ids) ? position_ids.map(Number).filter(Boolean) : []

  // Transaction: tạo user + gán vị trí phải toàn vẹn (cùng thành công hoặc cùng hủy).
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO app_user
        (username, email, password_hash, full_name, phone, employee_code, department_id, position_id, manager_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        username,
        email,
        passwordHash,
        full_name,
        phone,
        employee_code,
        department_id || null,
        posIds[0] || null,
        manager_id || null,
        role,
      ]
    )
    const userId = rows[0].id
    for (const pid of posIds) {
      await client.query(
        'INSERT INTO app_user_position (user_id, position_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, pid]
      )
    }
    await client.query('COMMIT')
    res.json({
      success: true,
      id: userId,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      
      if (constraint.includes('email')) {
        res.status(400).json({
          error: 'Email này đã tồn tại trong hệ thống.'
        })
      } else if (constraint.includes('username')) {
        res.status(400).json({
          error: 'Tên đăng nhập này đã tồn tại.'
        })
      } else if (constraint.includes('employee_code')) {
        res.status(400).json({
          error: 'Mã nhân viên này đã tồn tại.'
        })
      } else {
        res.status(400).json({
          error: 'Dữ liệu bị trùng lặp trong hệ thống.'
        })
      }
      return
    }

    logger.error('Lỗi khi tạo user:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo nhân viên.'
    })
  } finally {
    client.release()
  }
}

export async function checkEmailExists(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  
  if (!email) {
    res.status(400).json({
      error: 'Email không được để trống.'
    })
    return
  }
  
  const { rows } = await pool.query(
    'SELECT id FROM app_user WHERE email = $1',
    [email]
  )
  
  res.json({
    exists: rows.length > 0
  })
}

export async function checkUsernameExists(req, res) {
  const username = String(req.body?.username ?? '').trim()
  
  if (!username) {
    res.status(400).json({
      error: 'Tên đăng nhập không được để trống.'
    })
    return
  }
  
  const { rows } = await pool.query(
    'SELECT id FROM app_user WHERE username = $1',
    [username]
  )
  
  res.json({
    exists: rows.length > 0
  })
}

export async function checkEmployeeCodeExists(req, res) {
  const employee_code = String(req.body?.employee_code ?? '').trim()
  
  if (!employee_code) {
    res.status(400).json({
      error: 'Mã nhân viên không được để trống.'
    })
    return
  }
  
  const { rows } = await pool.query(
    'SELECT id FROM app_user WHERE employee_code = $1',
    [employee_code]
  )
  
  res.json({
    exists: rows.length > 0
  })
}

export async function getAllUsers(req, res) {
  const { rows } = await pool.query(`
    SELECT
      u.id, u.full_name, u.email, u.phone, u.role, u.username, u.employee_code,
      u.department_id, u.manager_id, u.telegram_chat_id,
      d.name AS department_name,
      m.full_name AS manager_name,
      COALESCE((
        SELECT json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.id)
        FROM app_user_position up JOIN position p ON p.id = up.position_id
        WHERE up.user_id = u.id
      ), '[]') AS positions
    FROM app_user u
    LEFT JOIN department d ON d.id = u.department_id
    LEFT JOIN app_user m   ON m.id = u.manager_id
    ORDER BY u.id
  `)

  // Non-admin chỉ cần id/tên/phòng ban/vị trí để hiển thị & phân công thành viên —
  // KHÔNG lộ thông tin liên hệ/định danh (email, sđt, mã NV, telegram, username).
  if (Number(req.user?.role) !== 1) {
    for (const u of rows) {
      delete u.email; delete u.phone; delete u.employee_code
      delete u.telegram_chat_id; delete u.username
    }
  }

  res.json(rows)
}

export async function getUserById(req, res) {
  const id = req.params.id

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.username, u.phone, u.employee_code,
       u.department_id, u.manager_id, u.telegram_chat_id,
       d.code AS department_code, d.name AS department_name,
       COALESCE((
         SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name) ORDER BY p.id)
         FROM app_user_position up JOIN position p ON p.id = up.position_id
         WHERE up.user_id = u.id
       ), '[]') AS positions
     FROM app_user u
     LEFT JOIN department d ON d.id = u.department_id
     WHERE u.id = $1`,
    [id]
  )

  const user = rows[0]

  if (!user) {
    res.status(404).json({
      error: 'User không tồn tại.'
    })
    return
  }

  res.json(user)
}

export async function updateUser(req, res) {
  const id = req.params.id
  const { username, email, password, full_name, phone, employee_code, department_id, position_ids, manager_id, role, telegram_chat_id } = req.body

  if (!username || !email) {
    res.status(400).json({ error: 'Tên đăng nhập và email là bắt buộc.' })
    return
  }
  if (password && password.trim() !== '' && String(password).length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ error: PASSWORD_TOO_SHORT })
    return
  }

  const posIds = Array.isArray(position_ids) ? position_ids.map(Number).filter(Boolean) : []
  const tgChatId = telegram_chat_id?.trim() || null

  // Transaction: cập nhật user + đồng bộ bảng vị trí phải toàn vẹn.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let rows
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      // Đặt mật khẩu mới → bump token_version để vô hiệu các phiên cũ của user này (F-05).
      ;({ rows } = await client.query(
        `UPDATE app_user SET
           username=$1, email=$2, full_name=$3, phone=$4, employee_code=$5,
           department_id=$6, position_id=$7, manager_id=$8, role=$9,
           password_hash=$10, telegram_chat_id=$11, token_version=token_version+1, updated_at=NOW()
         WHERE id=$12 RETURNING id, role, token_version`,
        [username, email.trim().toLowerCase(), full_name?.trim()||null, phone?.trim()||null,
         employee_code?.trim()||null, department_id||null, posIds[0]||null,
         manager_id||null, role, passwordHash, tgChatId, id]
      ))
    } else {
      ;({ rows } = await client.query(
        `UPDATE app_user SET
           username=$1, email=$2, full_name=$3, phone=$4, employee_code=$5,
           department_id=$6, position_id=$7, manager_id=$8, role=$9,
           telegram_chat_id=$10, updated_at=NOW()
         WHERE id=$11 RETURNING id`,
        [username, email.trim().toLowerCase(), full_name?.trim()||null, phone?.trim()||null,
         employee_code?.trim()||null, department_id||null, posIds[0]||null,
         manager_id||null, role, tgChatId, id]
      ))
    }

    if (rows.length === 0) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: 'Không tìm thấy người dùng.' })
      return
    }

    // Cập nhật junction table: xóa cũ, insert mới
    await client.query('DELETE FROM app_user_position WHERE user_id=$1', [id])
    for (const pid of posIds) {
      await client.query(
        'INSERT INTO app_user_position (user_id, position_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [id, pid]
      )
    }

    await client.query('COMMIT')

    // Admin tự đổi mật khẩu của chính mình qua form này → cấp lại cookie để không bị logout.
    if (password && password.trim() !== '' && String(req.user.id) === String(id)) {
      setAuthCookie(res, { id, role: rows[0].role, token_version: rows[0].token_version })
    }

    res.json({ success: true, id: rows[0].id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      if (constraint.includes('email')) {
        res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống.' })
      } else if (constraint.includes('username')) {
        res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại.' })
      } else if (constraint.includes('employee_code')) {
        res.status(400).json({ error: 'Mã nhân viên này đã tồn tại.' })
      } else {
        res.status(400).json({ error: 'Dữ liệu bị trùng lặp trong hệ thống.' })
      }
      return
    }
    logger.error('Lỗi khi cập nhật user:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật người dùng.' })
  } finally {
    client.release()
  }
}

export async function changePassword(req, res) {
  const id = req.params.id
  const { current_password, new_password } = req.body

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' })
    return
  }
  if (String(new_password).length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ error: PASSWORD_TOO_SHORT })
    return
  }

  const { rows } = await pool.query('SELECT password_hash FROM app_user WHERE id = $1', [id])
  const user = rows[0]
  if (!user) {
    res.status(404).json({ error: 'Người dùng không tồn tại.' })
    return
  }

  const ok = await bcrypt.compare(current_password, user.password_hash)
  if (!ok) {
    res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' })
    return
  }

  // Bump token_version để vô hiệu MỌI phiên đang đăng nhập của user này (F-05).
  const passwordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS)
  const { rows: updated } = await pool.query(
    `UPDATE app_user SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
     WHERE id = $2 RETURNING role, token_version`,
    [passwordHash, id],
  )

  // Tự đổi mật khẩu của mình → cấp lại cookie với version mới để không bị logout phiên hiện tại.
  if (String(req.user.id) === String(id)) {
    setAuthCookie(res, { id, role: updated[0].role, token_version: updated[0].token_version })
  }

  res.json({ success: true })
}

// ==================== DEPARTMENT CONTROLLER ====================

export async function getAllDepartments(req, res) {
  const { rows } = await pool.query(`
    SELECT
      id,
      code,
      name
    FROM department
    WHERE is_active = true
    ORDER BY id
  `)

  res.json(rows)
}

// ==================== POSITION CONTROLLER ====================

export async function getAllPositions(req, res) {
  const { rows } = await pool.query(`
    SELECT
      id,
      code,
      name
    FROM position
    ORDER BY id
  `)

  res.json(rows)
}

// ==================== MANAGER CONTROLLER ====================

export async function getAllManagers(req, res) {
  const { rows } = await pool.query(`
    SELECT
      id,
      full_name
    FROM app_user
    ORDER BY full_name
  `)

  res.json(rows)
}
