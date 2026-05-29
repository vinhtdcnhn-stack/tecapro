import bcrypt from 'bcryptjs'
import { pool } from '../db.js'

// ==================== AUTH CONTROLLER ====================

export async function login(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
    return
  }

  const { rows } = await pool.query(
    'select id, email, full_name, role, password_hash from app_user where email = $1',
    [email],
  )
  const user = rows[0]
  if (!user) {
    res.status(401).json({ error: 'Sai email hoặc mật khẩu.' })
    return
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    res.status(401).json({ error: 'Sai email hoặc mật khẩu.' })
    return
  }

  res.json({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role
  })
}

export async function seedAdmin(req, res) {
  const email = String(req.body?.email ?? 'admin@tecapro.local')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password ?? 'admin123')

  const passwordHash = await bcrypt.hash(password, 10)
  const r = await pool.query(
    `insert into app_user (email, password_hash)
     values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id, email`,
    [email, passwordHash],
  )
  res.json({ user: r.rows[0], password })
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
    position_id,
    manager_id,
    role
  } = req.body

  if (!username || !email || !password) {
    res.status(400).json({
      error: 'Thiếu dữ liệu.'
    })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO app_user (
        username,
        email,
        password_hash,
        full_name,
        phone,
        employee_code,
        department_id,
        position_id,
        manager_id,
        role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
      `,
      [
        username,
        email,
        passwordHash,
        full_name,
        phone,
        employee_code,
        department_id || null,
        position_id || null,
        manager_id || null,
        role
      ]
    )

    res.json({
      success: true,
      id: rows[0].id
    })
  } catch (err) {
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
    
    console.error('Lỗi khi tạo user:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo nhân viên.'
    })
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
  select
    u.id,
    u.full_name,
    u.email,
    u.phone,
    u.role,
    u.username,
    u.employee_code,
    u.department_id,
    u.position_id,
    u.manager_id,

    d.name as department_name,
    p.name as position_name,
    m.full_name as manager_name

  from app_user u

  left join department d
    on d.id = u.department_id

  left join position p
    on p.id = u.position_id

  left join app_user m
    on m.id = u.manager_id

  order by u.id
`)

  res.json(rows)
}

export async function getUserById(req, res) {
  const id = req.params.id

  const { rows } = await pool.query(
    `
    SELECT
      id,
      email,
      full_name,
      role,
      username,
      phone,
      employee_code,
      department_id,
      position_id,
      manager_id
    FROM app_user
    WHERE id = $1
    `,
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
  const {
    username,
    email,
    password,
    full_name,
    phone,
    employee_code,
    department_id,
    position_id,
    manager_id,
    role
  } = req.body

  if (!username || !email) {
    res.status(400).json({
      error: 'Tên đăng nhập và email là bắt buộc.'
    })
    return
  }

  let query = `
    UPDATE app_user
    SET
      username = $1,
      email = $2,
      full_name = $3,
      phone = $4,
      employee_code = $5,
      department_id = $6,
      position_id = $7,
      manager_id = $8,
      role = $9,
      updated_at = NOW()
  `

  const params = [
    username,
    email.trim().toLowerCase(),
    full_name?.trim() || null,
    phone?.trim() || null,
    employee_code?.trim() || null,
    department_id || null,
    position_id || null,
    manager_id || null,
    role,
    id
  ]

  // Nếu có mật khẩu mới thì cập nhật
  if (password && password.trim() !== '') {
    const passwordHash = await bcrypt.hash(password, 10)
    query = `
      UPDATE app_user
      SET
        username = $1,
        email = $2,
        full_name = $3,
        phone = $4,
        employee_code = $5,
        department_id = $6,
        position_id = $7,
        manager_id = $8,
        role = $9,
        password_hash = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING id
    `
    params.splice(9, 0, passwordHash)
    params.push(id)
  } else {
    query += `
      WHERE id = $10
      RETURNING id
    `
  }

  try {
    const { rows } = await pool.query(query, params)

    if (rows.length === 0) {
      res.status(404).json({
        error: 'Không tìm thấy người dùng.'
      })
      return
    }

    res.json({
      success: true,
      id: rows[0].id
    })
  } catch (err) {
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
    
    console.error('Lỗi khi cập nhật user:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật người dùng.'
    })
  }
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
