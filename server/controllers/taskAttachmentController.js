import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // taskId phải là số — chặn path traversal kiểu `..%2F..%2F` qua param.
    const taskId = String(req.params.taskId)
    if (!/^\d+$/.test(taskId)) {
      cb(new Error('ID không hợp lệ.'))
      return
    }
    const dir = path.join(UPLOADS_ROOT, 'tasks', taskId)
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
  const taskId = parseInt(req.params.taskId)
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.full_name AS uploaded_by_name
       FROM contract_task_attachment a
       LEFT JOIN app_user u ON u.id = a.uploaded_by
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC`,
      [taskId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getAttachments:', err)
    res.status(500).json({ error: 'Không thể tải tài liệu' })
  }
}

export async function uploadAttachment(req, res) {
  const taskId = parseInt(req.params.taskId)
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  const filePath = `/uploads/tasks/${taskId}/${req.file.filename}`
  // Người upload lấy từ phiên đã xác thực (không tin id do client gửi) — đồng bộ với documentController.
  const uploadedBy = req.user?.id || null

  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_task_attachment (task_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [taskId, originalName, filePath, req.file.size, req.file.mimetype, uploadedBy]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('uploadAttachment:', err)
    res.status(500).json({ error: 'Không thể lưu tài liệu' })
  }
}

export async function deleteAttachment(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT file_path FROM contract_task_attachment WHERE id = $1', [id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy' })

    // file_path do server tự ghi, nhưng vẫn chặn thoát khỏi uploads/ (defense-in-depth)
    const fullPath = path.resolve(path.join(__dirname, '..', String(rows[0].file_path)))
    if (fullPath.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath)

    await pool.query('DELETE FROM contract_task_attachment WHERE id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteAttachment:', err)
    res.status(500).json({ error: 'Không thể xóa tài liệu' })
  }
}
