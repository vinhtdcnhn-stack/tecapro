import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { safeUploadFilter, UPLOAD_LIMITS, discardUploadedFile } from '../middleware/uploadFilter.js'
import { notifyAction, notifyInfo } from '../services/notify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

const VALID_CATEGORIES = new Set(['ui', 'feature', 'performance', 'bug', 'other'])
const VALID_STATUSES = new Set(['open', 'in_progress', 'done', 'rejected'])
const STATUS_LABELS = {
  open: 'Mới', in_progress: 'Đang xử lý', done: 'Đã xong', rejected: 'Không tiếp nhận',
}
const MAX_PAGE_SIZE = 100

// Trích đoạn ngắn nội dung góp ý để chèn vào thông báo Telegram cho có ngữ cảnh.
const snippet = (s, n = 200) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

const isAdmin = (req) => Number(req.user?.role) === 1

// ── Upload ảnh đính kèm (chỉ ảnh) ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const fbId = String(req.params.id)
    if (!/^\d+$/.test(fbId)) { cb(new Error('ID không hợp lệ.')); return }
    const dir = path.join(UPLOADS_ROOT, 'feedback', fbId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
  },
})

// Chỉ nhận ảnh: chạy bộ lọc an toàn chung rồi siết thêm mime ảnh.
function imageOnlyFilter(req, file, cb) {
  safeUploadFilter(req, file, (err) => {
    if (err) { cb(err); return }
    if (!String(file.mimetype || '').startsWith('image/')) {
      cb(new Error('Chỉ cho phép đính kèm ảnh.')); return
    }
    cb(null, true)
  })
}

export const uploadFeedbackImage = multer({ storage, limits: UPLOAD_LIMITS, fileFilter: imageOnlyFilter })

// Gắn mảng ảnh vào từng góp ý (1 truy vấn cho cả trang).
async function attachImages(items) {
  if (!items.length) return items
  const ids = items.map(i => i.id)
  const { rows } = await pool.query(
    `SELECT id, feedback_id, file_name, file_path, mime_type
       FROM app_feedback_image WHERE feedback_id = ANY($1) ORDER BY id`,
    [ids],
  )
  const byFb = new Map()
  for (const r of rows) {
    if (!byFb.has(r.feedback_id)) byFb.set(r.feedback_id, [])
    byFb.get(r.feedback_id).push(r)
  }
  for (const it of items) it.images = byFb.get(it.id) || []
  return items
}

// GET /api/feedback?page=&pageSize=&status=  — admin xem tất cả, người dùng thường chỉ xem góp ý của mình.
// status (tùy chọn): lọc theo trạng thái xử lý; bỏ trống = tất cả.
export async function listFeedback(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))
  const offset = (page - 1) * pageSize
  const admin = isAdmin(req)
  const status = String(req.query.status || '')

  // Dựng điều kiện lọc động (quyền xem + trạng thái) dùng chung cho cả truy vấn danh sách và đếm.
  const conds = []
  const filterParams = []
  if (!admin) { filterParams.push(req.user.id); conds.push(`f.user_id = $${filterParams.length}`) }
  if (VALID_STATUSES.has(status)) { filterParams.push(status); conds.push(`f.status = $${filterParams.length}`) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.user_id, f.category, f.content, f.status, f.admin_note,
              f.created_at, f.updated_at, u.full_name AS user_name, u.email AS user_email
         FROM app_feedback f
         LEFT JOIN app_user u ON u.id = f.user_id
         ${where}
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, pageSize, offset],
    )
    await attachImages(rows)
    const { rows: cnt } = await pool.query(
      `SELECT count(*)::int AS total FROM app_feedback f ${where}`,
      filterParams,
    )
    res.json({ items: rows, total: cnt[0].total, page, pageSize, isAdmin: admin })
  } catch (err) {
    console.error('listFeedback:', err)
    res.status(500).json({ error: 'Không tải được danh sách góp ý.' })
  }
}

// POST /api/feedback  { content, category }  — bất kỳ người dùng đã đăng nhập.
export async function createFeedback(req, res) {
  const content = String(req.body?.content || '').trim()
  let category = String(req.body?.category || 'other')
  if (!content) return res.status(400).json({ error: 'Vui lòng nhập nội dung góp ý.' })
  if (!VALID_CATEGORIES.has(category)) category = 'other'
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_feedback (user_id, category, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, category, content],
    )
    const fb = rows[0]
    // Báo Telegram cho admin (cần xem) + cảm ơn người gửi (nắm thông tin). Fire-and-forget.
    notifyAdminsNewFeedback(req.user.id, content)
    notifyInfo([req.user.id], `Cảm ơn bạn đã gửi góp ý cải thiện phần mềm! 🙏\nGóp ý của bạn đã được ghi nhận, bộ phận quản trị sẽ xem xét sớm.\nNội dung: ${snippet(content)}`)
    res.status(201).json({ ...fb, images: [] })
  } catch (err) {
    console.error('createFeedback:', err)
    res.status(500).json({ error: 'Không gửi được góp ý.' })
  }
}

// POST /api/feedback/:id/images  (field 'image')  — chỉ tác giả góp ý mới được đính ảnh.
export async function addFeedbackImage(req, res) {
  const id = parseInt(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'Chưa có ảnh.' })
  try {
    const { rows: own } = await pool.query('SELECT user_id FROM app_feedback WHERE id = $1', [id])
    if (!own.length) {
      discardUploadedFile(req.file) // multer đã ghi file trước khi kiểm tra — dọn lại
      return res.status(404).json({ error: 'Không tìm thấy góp ý.' })
    }
    if (String(own[0].user_id) !== String(req.user.id)) {
      discardUploadedFile(req.file)
      return res.status(403).json({ error: 'Không có quyền đính kèm.' })
    }
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const filePath = `/uploads/feedback/${id}/${req.file.filename}`
    const { rows } = await pool.query(
      `INSERT INTO app_feedback_image (feedback_id, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, feedback_id, file_name, file_path, mime_type`,
      [id, fileName, filePath, req.file.size, req.file.mimetype],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('addFeedbackImage:', err)
    if (!res.headersSent) {
      discardUploadedFile(req.file) // chưa lưu được bản ghi DB → file trên đĩa là mồ côi
      res.status(500).json({ error: 'Không lưu được ảnh.' })
    }
  }
}

// PUT /api/feedback/:id  { status, admin_note }  — chỉ admin cập nhật xử lý.
export async function updateFeedback(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Chỉ admin được cập nhật.' })
  const id = parseInt(req.params.id)
  const status = req.body?.status
  if (status !== undefined && !VALID_STATUSES.has(String(status))) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  }
  try {
    // Lấy giá trị cũ để biết có thực sự thay đổi (chỉ báo Telegram khi đổi).
    const { rows: cur } = await pool.query(
      'SELECT user_id, status, admin_note FROM app_feedback WHERE id = $1', [id],
    )
    if (!cur.length) return res.status(404).json({ error: 'Không tìm thấy góp ý.' })
    const old = cur[0]

    const { rows } = await pool.query(
      `UPDATE app_feedback
          SET status = COALESCE($2, status),
              admin_note = COALESCE($3, admin_note),
              updated_at = now()
        WHERE id = $1
      RETURNING *`,
      [id, status ?? null, req.body?.admin_note ?? null],
    )
    const fb = rows[0]

    // Báo người gửi qua Telegram khi trạng thái đổi hoặc admin vừa phản hồi (fire-and-forget).
    const statusChanged = status !== undefined && String(status) !== String(old.status)
    const noteVal = req.body?.admin_note
    const noteChanged = noteVal !== undefined && String(noteVal || '') !== String(old.admin_note || '')
    if (statusChanged) {
      notifyInfo([old.user_id], `Góp ý của bạn đã được cập nhật trạng thái: ${STATUS_LABELS[fb.status] || fb.status}.\nNội dung: ${snippet(fb.content)}`)
    }
    if (noteChanged && String(noteVal || '').trim()) {
      notifyInfo([old.user_id], `Bạn nhận được phản hồi cho góp ý của mình:\n${snippet(noteVal, 400)}\n(Góp ý: ${snippet(fb.content)})`)
    }

    res.json(fb)
  } catch (err) {
    console.error('updateFeedback:', err)
    res.status(500).json({ error: 'Không cập nhật được góp ý.' })
  }
}

// DELETE /api/feedback/:id  — tác giả (góp ý của mình) hoặc admin.
export async function deleteFeedback(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query('SELECT user_id FROM app_feedback WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy góp ý.' })
    if (!isAdmin(req) && String(rows[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Không có quyền xóa.' })
    }
    await pool.query('DELETE FROM app_feedback WHERE id = $1', [id])
    // Xóa luôn thư mục ảnh trên ổ đĩa (defense-in-depth: chỉ trong uploads/feedback).
    const dir = path.resolve(UPLOADS_ROOT, 'feedback', String(id))
    if (dir.startsWith(path.join(UPLOADS_ROOT, 'feedback') + path.sep) && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('deleteFeedback:', err)
    res.status(500).json({ error: 'Không xóa được góp ý.' })
  }
}

// Báo cho mọi admin có Telegram khi có góp ý mới (fire-and-forget).
async function notifyAdminsNewFeedback(authorId, content) {
  try {
    const { rows } = await pool.query("SELECT id, full_name FROM app_user WHERE role = '1'")
    const adminIds = rows.map(r => r.id)
    if (!adminIds.length) return
    const { rows: a } = await pool.query('SELECT full_name, email FROM app_user WHERE id = $1', [authorId])
    const who = a[0]?.full_name || a[0]?.email || `#${authorId}`
    const snippet = content.length > 300 ? content.slice(0, 300) + '…' : content
    notifyAction(adminIds, `Góp ý cải thiện phần mềm mới từ ${who}:\n${snippet}`)
  } catch (err) {
    console.error('notifyAdminsNewFeedback:', err)
  }
}
