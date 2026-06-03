import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'tasks', String(req.params.taskId))
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
  },
})

export const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

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
  const uploadedBy = req.body.uploaded_by ? parseInt(req.body.uploaded_by) : null

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

    const fullPath = path.join(__dirname, '..', rows[0].file_path)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)

    await pool.query('DELETE FROM contract_task_attachment WHERE id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteAttachment:', err)
    res.status(500).json({ error: 'Không thể xóa tài liệu' })
  }
}
