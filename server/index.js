import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './db.js'
import { connectCache } from './cache.js'
import apiRoutes from './routes/index.js'
import { requireAuth } from './middleware/auth.js'
import { securityHeaders } from './middleware/securityHeaders.js'
import { logger } from './utils/logger.js'
import { startReminderScheduler } from './services/reminderScheduler.js'
import { startTaskAutoStartScheduler } from './services/taskAutoStart.js'
import { startOverdueAlertScheduler } from './services/overdueDebtScheduler.js'
import { purgeOldTelegramLogs } from './controllers/telegramLogController.js'
import { initPermissions } from './auth/seedPermissions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Ẩn header X-Powered-By: Express (giảm lộ thông tin framework).
app.disable('x-powered-by')

// Sau reverse proxy (nginx) trên VPS: tin X-Forwarded-* để req.ip phản ánh IP client thật (cho rate-limit).
app.set('trust proxy', 1)

// Security headers tổng thể (nosniff, X-Frame-Options, Referrer-Policy, CSP ở production).
// Đặt sớm để áp cho mọi response: API, file phục vụ tĩnh, lẫn SPA dist.
app.use(securityHeaders)

// CORS: chỉ cho phép các origin trong ALLOWED_ORIGINS (phân tách bằng dấu phẩy).
// Bật credentials để trình duyệt gửi cookie phiên. Nếu không cấu hình → phản chiếu origin (tiện cho dev).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
// Vì bật credentials (cookie phiên), KHÔNG phản chiếu mọi origin ở production:
// reflect-any + credentials cho phép bất kỳ site nào gọi API thay người dùng.
// - Có cấu hình ALLOWED_ORIGINS → chỉ cho phép danh sách đó.
// - Không cấu hình, production → tắt CORS (chỉ same-origin; frontend prod phục vụ từ /dist nên không cần CORS).
// - Không cấu hình, dev → phản chiếu origin cho tiện (Vite :5173 → API :5174).
const isProd = process.env.NODE_ENV === 'production'
if (!allowedOrigins.length && isProd) {
  logger.warn('[cors] ALLOWED_ORIGINS chưa cấu hình ở production — chỉ cho phép same-origin. Đặt ALLOWED_ORIGINS nếu frontend khác origin.')
}
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : (isProd ? false : true),
  credentials: true,
  // Lộ ETag cho JS đọc khi cross-origin (dev :5173 → :5174): lớp xác thực nhẹ phía client
  // (apiGet conditional) cần đọc header này để gửi lại If-None-Match. Same-origin (prod)
  // không cần CORS nên không ảnh hưởng.
  exposedHeaders: ['ETag'],
}))
// Body JSON: giữ mặc định 100KB (chống body lớn làm tốn RAM/CPU), nhưng các endpoint
// import nhận mảng JSON lớn (BOQ/serial parse từ Excel) được nới riêng 2MB — file vài
// nghìn dòng vượt 100KB là tình huống thật. Parser nới phải mount TRƯỚC parser mặc định:
// body-parser bỏ qua request đã được parser trước đọc xong.
app.use([
  '/api/contracts/:contractId/boq/save-import',
  '/api/contract-ins/:contractInId/boq/save-import',
  '/api/contracts/:id/equipment/import',
  '/api/contracts/:id/serials/import',
], express.json({ limit: '2mb' }))
app.use(express.json())

// Serve uploaded files — YÊU CẦU đăng nhập (link same-origin ở production tự gửi cookie phiên).
// Tài liệu HĐ phục vụ qua /api/files/:id/view; mount này chủ yếu cho file đính kèm công việc.
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}))

// Health check — public, nên cache kết quả DB 5 giây: spam endpoint này không được
// phép chiếm connection của pool (pg.Pool mặc định max 10) làm nghẽn request thật.
let healthCache = { at: 0, db: false }
app.get('/api/health', async (_req, res) => {
  if (Date.now() - healthCache.at > 5000) {
    const r = await pool.query('select 1 as ok')
    healthCache = { at: Date.now(), db: r.rows[0].ok === 1 }
  }
  res.json({ ok: true, db: healthCache.db })
})

// Mount routes (apiRoutes tự chặn các route nội bộ bằng requireAuth, gồm cả /customers)
app.use('/api', apiRoutes)

// 404 rõ ràng cho API/uploads không khớp: nếu không, request rơi xuống SPA fallback
// bên dưới và trả index.html (HTML 200) — che lỗi và gây nhầm cho client gọi API.
app.use(['/api', '/uploads'], (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Serve React frontend in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Global error handler — ghi log đầy đủ phía server, nhưng KHÔNG lộ stack trace cho client ở production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`${req.method} ${req.originalUrl} →`, err)
  if (res.headersSent) return
  // Lỗi file vượt giới hạn của multer
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Tệp quá lớn (tối đa 50MB).' })
    return
  }
  const status = err?.status || err?.statusCode || 500
  const isProd = process.env.NODE_ENV === 'production'
  res.status(status).json({ error: isProd ? 'Đã xảy ra lỗi máy chủ.' : (err?.message || 'Server error') })
})

const port = Number(process.env.PORT ?? 5174)

// Production chỉ bind loopback: mọi truy cập từ ngoài phải qua nginx, không gọi thẳng
// được vào Express để giả X-Forwarded-For vượt rate-limit (trust proxy 1). Override
// bằng env HOST nếu hạ tầng khác (vd chạy trong container cần 0.0.0.0).
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0')

app.listen(port, host, () => {
  logger.info(`[server] listening on http://${host}:${port}`)
  // Kết nối Redis cache (tự bỏ qua nếu không cấu hình REDIS_URL — cache TẮT, query thẳng DB).
  connectCache()
  // Đồng bộ danh mục quyền (RBAC) từ permissionCatalog.js + seed bootstrap lần đầu.
  initPermissions()
    .then(r => logger.info(`[permissions] catalog đã đồng bộ${r?.skipped ? '' : ' + bootstrap seed lần đầu'}.`))
    .catch(err => logger.error('[permissions] đồng bộ thất bại:', err))
  // Bộ nhắc hạn Telegram hàng ngày (tự bỏ qua nếu không cấu hình bot token).
  startReminderScheduler()
  // Tự chuyển công việc "Chờ xử lý" → "Đang thực hiện" khi tới ngày bắt đầu hiệu lực.
  startTaskAutoStartScheduler()
  // Cảnh báo nợ quá hạn leo thang (tự bỏ qua nếu không cấu hình Telegram).
  startOverdueAlertScheduler()
  // Dọn nhật ký gửi Telegram quá 3 ngày: chạy ngay khi khởi động + mỗi 6 giờ.
  purgeOldTelegramLogs()
  setInterval(purgeOldTelegramLogs, 6 * 60 * 60 * 1000).unref()
})