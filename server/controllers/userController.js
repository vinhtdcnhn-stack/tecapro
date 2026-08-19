import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { sendTelegramNow } from '../services/telegram.js'
import { logger } from '../utils/logger.js'
import { cacheWrap } from '../cache.js'
import { lookupKey, invalidateLookup, lookupNotModified } from '../services/cacheKeys.js'
import { loadGlobalPermissions } from '../auth/permissions.js'
import {
  USERS_TTL, BCRYPT_ROUNDS, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT, setAuthCookie,
} from './authShared.js'

// ==================== USER CONTROLLER ====================
// Hồ sơ người dùng: tạo/sửa/tra cứu, đổi mật khẩu, Telegram cá nhân.

export async function createUser(req, res) {
  const {
    username,
    email,
    password,
    full_name,
    phone,
    employee_code,
    department_id,
    department_ids,
    position_ids,
    manager_id,
    role,
    is_active
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
  // Ban KIÊM NHIỆM (chỉ dùng cho phân quyền) — bỏ phòng chính khỏi danh sách để tránh trùng.
  const deptIds = Array.isArray(department_ids)
    ? [...new Set(department_ids.map(Number).filter(Boolean))].filter(d => d !== Number(department_id))
    : []

  // Transaction: tạo user + gán vị trí phải toàn vẹn (cùng thành công hoặc cùng hủy).
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO app_user
        (username, email, password_hash, full_name, phone, employee_code, department_id, position_id, manager_id, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        is_active !== false,
      ]
    )
    const userId = rows[0].id
    for (const pid of posIds) {
      await client.query(
        'INSERT INTO app_user_position (user_id, position_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, pid]
      )
    }
    for (const did of deptIds) {
      await client.query(
        'INSERT INTO app_user_department (user_id, department_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, did]
      )
    }
    await client.query('COMMIT')
    // Tạo user đổi danh sách users/managers; gán vị trí có thể đổi thành viên phòng KT cơ điện.
    invalidateLookup('users', 'managers', 'dw-members', 'approval-users')
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

// Gửi thử một tin chào mừng tới Telegram Chat ID để admin kiểm tra cấu hình.
// Lấy chat id trực tiếp từ body (admin đang nhập trong form, có thể chưa lưu).
export async function testTelegram(req, res) {
  const chatId = String(req.body?.telegram_chat_id ?? '').trim()
  const name = String(req.body?.full_name ?? '').trim()
  if (!chatId) {
    res.status(400).json({ error: 'Vui lòng nhập Telegram Chat ID trước khi gửi thử.' })
    return
  }

  const greeting = name ? `${name} thân mến,` : 'Xin chào,'
  const text =
    `🎉 <b>Chào mừng bạn tham gia hệ thống TECAPRO!</b>\n\n` +
    `${greeting}\n` +
    `Đây là tin nhắn kiểm tra. Nếu bạn nhận được tin này, Telegram Chat ID đã được ` +
    `cấu hình đúng và bạn sẽ nhận được các thông báo của hệ thống.`

  const result = await sendTelegramNow(chatId, text)
  if (!result.ok) {
    res.status(400).json({ error: result.error || 'Không gửi được tin nhắn Telegram.' })
    return
  }
  res.json({ success: true })
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
  // Cache bản THÔ (đầy đủ field) dùng chung; redaction theo role làm trên BẢN SAO mỗi
  // request để không mutate object đang nằm trong cache.
  // ETag = version 'lookup:users' (toàn cục). Body trả về có redact theo role người gọi, nên
  // ETag giống nhau giữa các role vẫn an toàn: mỗi client giữ bản redact của RIÊNG mình và
  // xóa khi đăng xuất (clearConditionalCache). 304 chỉ nói "danh sách chưa đổi".
  if (await lookupNotModified(req, res, 'users')) return
  const rows = await cacheWrap(lookupKey('users'), USERS_TTL, async () => {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.full_name, u.email, u.phone, u.role, u.username, u.employee_code,
        u.department_id, u.manager_id, u.telegram_chat_id, u.is_active,
        d.name AS department_name,
        m.full_name AS manager_name,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.id)
          FROM app_user_position up JOIN position p ON p.id = up.position_id
          WHERE up.user_id = u.id
        ), '[]') AS positions,
        COALESCE((
          SELECT json_agg(json_build_object('id', d2.id, 'name', d2.name) ORDER BY d2.id)
          FROM app_user_department ud JOIN department d2 ON d2.id = ud.department_id
          WHERE ud.user_id = u.id
        ), '[]') AS extra_departments
      FROM app_user u
      LEFT JOIN department d ON d.id = u.department_id
      LEFT JOIN app_user m   ON m.id = u.manager_id
      ORDER BY u.id
    `)
    return rows
  })

  // Non-admin chỉ cần id/tên/phòng ban/vị trí để hiển thị & phân công thành viên —
  // KHÔNG lộ thông tin liên hệ/định danh (email, sđt, mã NV, telegram, username).
  if (Number(req.user?.role) !== 1) {
    const redacted = rows.map(({ email, phone, employee_code, telegram_chat_id, username, ...rest }) => rest)
    res.json(redacted)
    return
  }

  res.json(rows)
}

export async function getUserById(req, res) {
  const id = req.params.id

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.username, u.phone, u.employee_code,
       u.department_id, u.manager_id, u.telegram_chat_id, u.is_active,
       d.code AS department_code, d.name AS department_name,
       COALESCE((
         SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name) ORDER BY p.id)
         FROM app_user_position up JOIN position p ON p.id = up.position_id
         WHERE up.user_id = u.id
       ), '[]') AS positions,
       COALESCE((
         SELECT json_agg(json_build_object('id', d2.id, 'name', d2.name) ORDER BY d2.id)
         FROM app_user_department ud JOIN department d2 ON d2.id = ud.department_id
         WHERE ud.user_id = u.id
       ), '[]') AS extra_departments,
       EXISTS(SELECT 1 FROM contract_out_member m WHERE m.user_id = u.id) AS has_projects
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

  // Quyền toàn cục (lớp A) — để FE lọc menu / nút theo RBAC. /auth/me dùng chính object này.
  user.permissions = await loadGlobalPermissions(user.id, user.role)
  res.json(user)
}

export async function updateUser(req, res) {
  const id = req.params.id
  const { username, email, password, full_name, phone, employee_code, department_id, department_ids, position_ids, manager_id, role, telegram_chat_id, is_active } = req.body

  if (!username || !email) {
    res.status(400).json({ error: 'Tên đăng nhập và email là bắt buộc.' })
    return
  }
  if (password && password.trim() !== '' && String(password).length < PASSWORD_MIN_LENGTH) {
    res.status(400).json({ error: PASSWORD_TOO_SHORT })
    return
  }

  const posIds = Array.isArray(position_ids) ? position_ids.map(Number).filter(Boolean) : []
  // Ban KIÊM NHIỆM (chỉ dùng cho phân quyền) — bỏ phòng chính khỏi danh sách để tránh trùng.
  const deptIds = Array.isArray(department_ids)
    ? [...new Set(department_ids.map(Number).filter(Boolean))].filter(d => d !== Number(department_id))
    : []
  const tgChatId = telegram_chat_id?.trim() || null
  // Trạng thái làm việc: chỉ nhận khi client gửi lên, mặc định giữ nguyên giá trị cũ.
  const active = is_active === undefined ? null : is_active !== false

  // Tự khóa chính mình sẽ đá admin ra khỏi hệ thống ngay lập tức → chặn từ đầu.
  if (active === false && String(req.user.id) === String(id)) {
    res.status(400).json({ error: 'Không thể tự ngừng hoạt động tài khoản của chính bạn.' })
    return
  }

  // Transaction: cập nhật user + đồng bộ bảng vị trí phải toàn vẹn.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let rows
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
      // Đặt mật khẩu mới → bump token_version để vô hiệu các phiên cũ của user này.
      ;({ rows } = await client.query(
        `UPDATE app_user SET
           username=$1, email=$2, full_name=$3, phone=$4, employee_code=$5,
           department_id=$6, position_id=$7, manager_id=$8, role=$9,
           password_hash=$10, telegram_chat_id=$11, is_active=COALESCE($12::boolean, is_active),
           token_version=token_version+1, updated_at=NOW()
         WHERE id=$13 RETURNING id, role, token_version`,
        [username, email.trim().toLowerCase(), full_name?.trim()||null, phone?.trim()||null,
         employee_code?.trim()||null, department_id||null, posIds[0]||null,
         manager_id||null, role, passwordHash, tgChatId, active, id]
      ))
    } else {
      ;({ rows } = await client.query(
        `UPDATE app_user SET
           username=$1, email=$2, full_name=$3, phone=$4, employee_code=$5,
           department_id=$6, position_id=$7, manager_id=$8, role=$9,
           telegram_chat_id=$10, is_active=COALESCE($11::boolean, is_active),
           -- Ngừng hoạt động → bump token_version để thu hồi luôn mọi phiên đang mở.
           token_version=token_version + (CASE WHEN $11::boolean IS FALSE AND is_active THEN 1 ELSE 0 END),
           updated_at=NOW()
         WHERE id=$12 RETURNING id`,
        [username, email.trim().toLowerCase(), full_name?.trim()||null, phone?.trim()||null,
         employee_code?.trim()||null, department_id||null, posIds[0]||null,
         manager_id||null, role, tgChatId, active, id]
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
    // Ban kiêm nhiệm (chỉ ảnh hưởng phân quyền): xóa cũ, insert mới
    await client.query('DELETE FROM app_user_department WHERE user_id=$1', [id])
    for (const did of deptIds) {
      await client.query(
        'INSERT INTO app_user_department (user_id, department_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [id, did]
      )
    }

    await client.query('COMMIT')

    // Admin tự đổi mật khẩu của chính mình qua form này → cấp lại cookie để không bị logout.
    if (password && password.trim() !== '' && String(req.user.id) === String(id)) {
      setAuthCookie(res, { id, role: rows[0].role, token_version: rows[0].token_version })
    }

    // Sửa user (tên/phòng/vị trí) đổi users/managers + có thể đổi thành viên phòng KT cơ điện.
    invalidateLookup('users', 'managers', 'dw-members', 'approval-users')
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

  // Bump token_version để vô hiệu MỌI phiên đang đăng nhập của user này.
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

// Người dùng tự cập nhật Telegram Chat ID của chính mình (id đã được requireSelfOrAdmin gác).
export async function updateMyTelegram(req, res) {
  const id = req.params.id
  const tgChatId = String(req.body?.telegram_chat_id ?? '').trim() || null

  const { rows } = await pool.query(
    `UPDATE app_user SET telegram_chat_id = $1, updated_at = NOW()
     WHERE id = $2 RETURNING id, telegram_chat_id`,
    [tgChatId, id],
  )
  if (!rows.length) {
    res.status(404).json({ error: 'Người dùng không tồn tại.' })
    return
  }
  res.json({ success: true, telegram_chat_id: rows[0].telegram_chat_id })
}
