import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

// Guard ĐẶT TRƯỚC multer: chỉ người gửi (khi đơn còn nháp/chờ duyệt) hoặc admin được tải tệp lên.
export async function canUploadAttachment(req, res, next) {
  const id = parseInt(req.params.requestId, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rows } = await pool.query(`SELECT requester_id, status FROM approval_request WHERE id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đơn.' })
    const isAdmin = Number(req.user.role) === 1
    const isOwner = rows[0].requester_id === req.user.id
    if (!isAdmin && !(isOwner && ['draft', 'pending'].includes(rows[0].status))) {
      return res.status(403).json({ error: 'Bạn không có quyền đính kèm tệp cho đơn này.' })
    }
    next()
  } catch (err) {
    console.error('canUploadAttachment:', err)
    res.status(500).json({ error: 'Lỗi máy chủ.' })
  }
}

// requestId phải là số — chặn path traversal qua param.
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const requestId = String(req.params.requestId)
    if (!/^\d+$/.test(requestId)) { cb(new Error('ID không hợp lệ.')); return }
    const dir = path.join(UPLOADS_ROOT, 'approval-requests', requestId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
  },
})

export const upload = multer({ storage, limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

export async function getAttachments(req, res) {
  const id = parseInt(req.params.requestId, 10)
  try {
    // Quyền xem: người gửi / người duyệt bất kỳ bước / admin.
    const { rows: r } = await pool.query(`SELECT requester_id FROM approval_request WHERE id = $1`, [id])
    if (!r.length) return res.status(404).json({ error: 'Không tìm thấy đơn.' })
    let allowed = Number(req.user.role) === 1 || r[0].requester_id === req.user.id
    if (!allowed) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM approval_request_step s
           JOIN approval_request_step_approver sa ON sa.step_id = s.id
          WHERE s.request_id = $1 AND sa.approver_id = $2 LIMIT 1`,
        [id, req.user.id]
      )
      allowed = rowCount > 0
    }
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền xem tệp của đơn này.' })

    const { rows } = await pool.query(
      `SELECT a.id, a.file_name, a.file_path, a.file_size, a.mime_type, a.uploaded_by,
              u.full_name AS uploaded_by_name, a.created_at
         FROM approval_request_attachment a
         LEFT JOIN app_user u ON u.id = a.uploaded_by
        WHERE a.request_id = $1 ORDER BY a.created_at DESC`,
      [id]
    )
    res.json(rows)
  } catch (err) {
    console.error('approval getAttachments:', err)
    res.status(500).json({ error: 'Không thể tải tài liệu.' })
  }
}

export async function uploadAttachment(req, res) {
  const id = parseInt(req.params.requestId, 10)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  const filePath = `/uploads/approval-requests/${id}/${req.file.filename}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO approval_request_attachment
         (request_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, originalName, filePath, req.file.size, req.file.mimetype, req.user?.id || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* best-effort */ } }
    console.error('approval uploadAttachment:', err)
    res.status(500).json({ error: 'Không thể lưu tài liệu.' })
  }
}

export async function deleteAttachment(req, res) {
  const id = parseInt(req.params.id, 10)
  try {
    const { rows } = await pool.query(
      'SELECT file_path, uploaded_by FROM approval_request_attachment WHERE id = $1', [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' })
    // Xóa được nếu là admin hoặc chính người đã tải lên.
    if (Number(req.user.role) !== 1 && rows[0].uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa tài liệu này.' })
    }
    const fullPath = path.resolve(path.join(__dirname, '..', String(rows[0].file_path)))
    if (fullPath.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    await pool.query('DELETE FROM approval_request_attachment WHERE id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('approval deleteAttachment:', err)
    res.status(500).json({ error: 'Không thể xóa tài liệu.' })
  }
}
