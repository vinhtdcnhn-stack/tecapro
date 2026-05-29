import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import { pool } from './db.js'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  const r = await pool.query('select 1 as ok')
  res.json({ ok: true, db: r.rows[0].ok === 1 })
})

app.post('/api/auth/login', async (req, res) => {
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

})

app.post('/api/auth/seed', async (req, res) => {
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
})

app.post('/api/users', async (req, res) => {

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

  const passwordHash =
    await bcrypt.hash(password, 10)

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
    // Xử lý lỗi duplicate key
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
    
    // Lỗi khác
    console.error('Lỗi khi tạo user:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo nhân viên.'
    })
  }
})

// API kiểm tra email đã tồn tại chưa
app.post('/api/users/check-email', async (req, res) => {
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
})

app.get('/api/users', async (_req, res) => {
  const { rows } = await pool.query(`
  select
    u.id,
    u.full_name,
    u.email,
    u.phone,
    u.role,

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
})


app.get('/api/me/:id', async (req, res) => {

  const id = req.params.id

  const { rows } = await pool.query(
    `
    SELECT
      id,
      email,
      full_name,
      role
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
})

const port = Number(process.env.PORT ?? 5174)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
})

app.get('/api/departments', async (_req, res) => {

  const { rows } = await pool.query(`
    SELECT
      id,
      name
    FROM department
    WHERE is_active = true
    ORDER BY id
  `)

  res.json(rows)
})

app.get('/api/positions', async (_req, res) => {

  const { rows } = await pool.query(`
    SELECT
      id,
      name
    FROM position
    ORDER BY id
  `)

  res.json(rows)
})

  app.get('/api/managers', async (_req, res) => {

  const { rows } = await pool.query(`
    SELECT
      id,
      full_name
    FROM app_user
    ORDER BY full_name
  `)

  res.json(rows)
})

// ==================== CUSTOMER APIs ====================

// Lấy danh sách khách hàng
app.get('/api/customers', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      id,
      code,
      name,
      tax_code,
      address,
      contact_person,
      phone,
      email,
      is_active,
      created_at,
      updated_at
    FROM customer
    ORDER BY id DESC
  `)

  res.json(rows)
})

// Kiểm tra code khách hàng đã tồn tại chưa
app.post('/api/customers/check-code', async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  
  if (!code) {
    res.status(400).json({
      error: 'Mã khách hàng không được để trống.'
    })
    return
  }
  
  const { rows } = await pool.query(
    'SELECT id FROM customer WHERE code = $1',
    [code]
  )
  
  res.json({
    exists: rows.length > 0
  })
})

// Thêm mới khách hàng
app.post('/api/customers', async (req, res) => {
  const {
    code,
    name,
    tax_code,
    address,
    contact_person,
    phone,
    email,
    is_active,
    created_by
  } = req.body

  if (!code || !name) {
    res.status(400).json({
      error: 'Mã khách hàng và tên khách hàng là bắt buộc.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO customer (
        code,
        name,
        tax_code,
        address,
        contact_person,
        phone,
        email,
        is_active,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, code, name
      `,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        is_active !== false,
        created_by || null
      ]
    )

    res.json({
      success: true,
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name
    })
  } catch (err) {
    // Xử lý lỗi duplicate key
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      
      if (constraint.includes('code') || constraint.includes('customer_code_key')) {
        res.status(400).json({
          error: 'Mã khách hàng này đã tồn tại trong hệ thống.'
        })
      } else {
        res.status(400).json({
          error: 'Dữ liệu bị trùng lặp trong hệ thống.'
        })
      }
      return
    }
    
    // Lỗi khác
    console.error('Lỗi khi tạo customer:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo khách hàng.'
    })
  }
})

// Cập nhật khách hàng
app.put('/api/customers/:id', async (req, res) => {
  const id = req.params.id
  const {
    code,
    name,
    tax_code,
    address,
    contact_person,
    phone,
    email,
    is_active,
    updated_by
  } = req.body

  if (!code || !name) {
    res.status(400).json({
      error: 'Mã khách hàng và tên khách hàng là bắt buộc.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE customer
      SET
        code = $1,
        name = $2,
        tax_code = $3,
        address = $4,
        contact_person = $5,
        phone = $6,
        email = $7,
        is_active = $8,
        updated_by = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING id, code, name
      `,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        is_active !== false,
        updated_by || null,
        id
      ]
    )

    if (rows.length === 0) {
      res.status(404).json({
        error: 'Không tìm thấy khách hàng.'
      })
      return
    }

    res.json({
      success: true,
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name
    })
  } catch (err) {
    // Xử lý lỗi duplicate key
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      
      if (constraint.includes('code') || constraint.includes('customer_code_key')) {
        res.status(400).json({
          error: 'Mã khách hàng này đã tồn tại trong hệ thống.'
        })
      } else {
        res.status(400).json({
          error: 'Dữ liệu bị trùng lặp trong hệ thống.'
        })
      }
      return
    }
    
    // Lỗi khác
    console.error('Lỗi khi cập nhật customer:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật khách hàng.'
    })
  }
})