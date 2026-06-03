import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './db.js'
import apiRoutes from './routes/index.js'
import customerRoutes from './routes/customerRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Health check
app.get('/api/health', async (_req, res) => {
  const r = await pool.query('select 1 as ok')
  res.json({ ok: true, db: r.rows[0].ok === 1 })
})

// Mount routes
app.use('/api', apiRoutes)
app.use('/api', customerRoutes)

// Serve React frontend in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const port = Number(process.env.PORT ?? 5174)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
})