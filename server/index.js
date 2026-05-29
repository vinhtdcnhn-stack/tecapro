import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import apiRoutes from './routes/index.js'
import customerRoutes from './routes/customerRoutes.js'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

// Health check
app.get('/api/health', async (_req, res) => {
  const r = await pool.query('select 1 as ok')
  res.json({ ok: true, db: r.rows[0].ok === 1 })
})

// Mount routes
app.use('/api', apiRoutes)
app.use('/api', customerRoutes)

const port = Number(process.env.PORT ?? 5174)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`)
})