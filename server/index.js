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
    'select id, email, password_hash from app_user where email = $1',
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

  res.json({ id: user.id, email: user.email })
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

app.get('/api/users', async (_req, res) => {
  const { rows } = await pool.query(
    'select id, full_name, email, phone, role from app_user order by id'
  )

  res.json(rows)
})
const port = Number(process.env.PORT ?? 5174)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
})

