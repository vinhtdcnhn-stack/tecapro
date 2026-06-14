import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'
import { userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

// taskId phải là số — chặn path traversal qua param.
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const taskId = String(req.params.taskId)
    if (!/^\d+$/.test(taskId)) { cb(new Error('ID không hợp lệ.')); return }
    const dir = path.join(UPLOADS_ROOT, 'dept-work-tasks', taskId)
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
      `SELECT a.id, a.task_id, a.file_name, a.file_path, a.file_size, a.mime_type,
              a.uploaded_by, u.full_name AS uploaded_by_name, a.created_at
         FROM dept_work_task_attachment a
         LEFT JOIN app_user u ON u.id = a.uploaded_by
        WHERE a.task_id = $1
        ORDER BY a.created_at DESC`,
      [taskId],
    )
    res.json(rows)
  } catch (err) {
    console.error('deptWork getAttachments:', err)
    res.status(500).json({ error: 'Không thể tải tài liệu.' })
  }
}

export async function uploadAttachment(req, res) {
  const taskId = parseInt(req.params.taskId)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  const filePath = `/uploads/dept-work-tasks/${taskId}/${req.file.filename}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO dept_work_task_attachment
         (task_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [taskId, originalName, filePath, req.file.size, req.file.mimetype, req.user?.id || null],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* best-effort */ } }
    console.error('deptWork uploadAttachment:', err)
    res.status(500).json({ error: 'Không thể lưu tài liệu.' })
  }
}

export async function deleteAttachment(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT file_path, uploaded_by FROM dept_work_task_attachment WHERE id = $1', [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' })

    // Cho xóa nếu là trưởng/phó phòng/admin HOẶC chính người đã tải lên.
    const isHead = await userIsHeadOrDeputy(req.user.id, req.user.role)
    if (!isHead && rows[0].uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa tài liệu này.' })
    }

    // file_path do server tự ghi, vẫn chặn thoát khỏi uploads/ (defense-in-depth).
    const fullPath = path.resolve(path.join(__dirname, '..', String(rows[0].file_path)))
    if (fullPath.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath)

    await pool.query('DELETE FROM dept_work_task_attachment WHERE id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('deptWork deleteAttachment:', err)
    res.status(500).json({ error: 'Không thể xóa tài liệu.' })
  }
}
