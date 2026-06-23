import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tệp của module Đấu thầu: sản phẩm từng đầu việc (checklist) + file tổng hợp hồ sơ.
// Lưu dưới server/uploads/tender-items/{itemId}/ và tender-summary/{tenderId}/.
// Phục vụ inline (view) + tải về (download). Mọi route gác bằng tenderAccess.
// ──────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

function makeStorage(subdir, param) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const id = String(req.params[param])
      if (!/^\d+$/.test(id)) { cb(new Error('ID không hợp lệ.')); return }
      const dir = path.join(UPLOADS_ROOT, subdir, id)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename(req, file, cb) {
      const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
      cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
    },
  })
}

export const uploadItem = multer({ storage: makeStorage('tender-items', 'itemId'), limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })
export const uploadSummary = multer({ storage: makeStorage('tender-summary', 'id'), limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })
export const uploadVersion = multer({ storage: makeStorage('tender-versions', 'id'), limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

// ── Helper chung phục vụ tệp ──────────────────────────────────────────────────
async function serve(res, table, id, { inline }) {
  const { rows } = await pool.query(
    `SELECT file_path, file_name, mime_type FROM ${table} WHERE id = $1`, [id])
  if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tệp.' })
  const f = rows[0]
  const abs = path.resolve(path.join(__dirname, '..', String(f.file_path)))
  if (!abs.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(abs)) {
    return res.status(404).json({ error: 'Tệp không tồn tại.' })
  }
  if (inline) {
    res.type(f.mime_type || 'application/octet-stream')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(abs)
  } else {
    res.download(abs, f.file_name)
  }
}

async function removeFile(table, id, res, req, { editorOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT file_path, uploaded_by FROM ${table} WHERE id = $1`, [id])
  if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tệp.' })
  // Người tải lên hoặc người có quyền sửa (đã gác ở middleware) đều xoá được.
  const abs = path.resolve(path.join(__dirname, '..', String(rows[0].file_path)))
  if (abs.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(abs)) {
    try { fs.unlinkSync(abs) } catch { /* best-effort */ }
  }
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id])
  res.json({ success: true })
}

// ── Đính kèm đầu việc ─────────────────────────────────────────────────────────
export async function getItemAttachments(req, res) {
  const itemId = parseInt(req.params.itemId)
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.item_id, a.file_name, a.file_size, a.mime_type,
              a.uploaded_by, u.full_name AS uploaded_by_name, a.created_at
         FROM tender_checklist_attachment a
         LEFT JOIN app_user u ON u.id = a.uploaded_by
        WHERE a.item_id = $1 ORDER BY a.created_at DESC`,
      [itemId],
    )
    res.json(rows)
  } catch (err) {
    console.error('getItemAttachments:', err)
    res.status(500).json({ error: 'Không thể tải tài liệu.' })
  }
}

export async function uploadItemAttachment(req, res) {
  const itemId = parseInt(req.params.itemId)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  const filePath = `/uploads/tender-items/${itemId}/${req.file.filename}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO tender_checklist_attachment
         (item_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, created_at`,
      [itemId, name, filePath, req.file.size, req.file.mimetype, req.user.id],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* noop */ } }
    console.error('uploadItemAttachment:', err)
    res.status(500).json({ error: 'Không thể lưu tài liệu.' })
  }
}

export const deleteItemAttachment = (req, res) =>
  removeFile('tender_checklist_attachment', parseInt(req.params.id), res, req)
export const viewAttachment = (req, res) =>
  serve(res, 'tender_checklist_attachment', parseInt(req.params.id), { inline: true })
export const downloadAttachment = (req, res) =>
  serve(res, 'tender_checklist_attachment', parseInt(req.params.id), { inline: false })

// ── File tổng hợp hồ sơ ───────────────────────────────────────────────────────
export async function getSummaryFiles(req, res) {
  const tenderId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.tender_id, s.file_name, s.file_size, s.mime_type,
              s.uploaded_by, u.full_name AS uploaded_by_name, s.created_at
         FROM tender_summary_file s
         LEFT JOIN app_user u ON u.id = s.uploaded_by
        WHERE s.tender_id = $1 ORDER BY s.created_at DESC`,
      [tenderId],
    )
    res.json(rows)
  } catch (err) {
    console.error('getSummaryFiles:', err)
    res.status(500).json({ error: 'Không thể tải hồ sơ tổng hợp.' })
  }
}

export async function uploadSummaryFile(req, res) {
  const tenderId = parseInt(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  const filePath = `/uploads/tender-summary/${tenderId}/${req.file.filename}`
  try {
    const { rows } = await pool.query(
      `INSERT INTO tender_summary_file
         (tender_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, created_at`,
      [tenderId, name, filePath, req.file.size, req.file.mimetype, req.user.id],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* noop */ } }
    console.error('uploadSummaryFile:', err)
    res.status(500).json({ error: 'Không thể lưu hồ sơ.' })
  }
}

export const deleteSummaryFile = (req, res) =>
  removeFile('tender_summary_file', parseInt(req.params.id), res, req)
export const viewSummary = (req, res) =>
  serve(res, 'tender_summary_file', parseInt(req.params.id), { inline: true })
export const downloadSummary = (req, res) =>
  serve(res, 'tender_summary_file', parseInt(req.params.id), { inline: false })

// ── Phục vụ phiên bản hồ sơ review ───────────────────────────────────────────
export const viewVersion = (req, res) =>
  serve(res, 'tender_document_version', parseInt(req.params.id), { inline: true })
export const downloadVersion = (req, res) =>
  serve(res, 'tender_document_version', parseInt(req.params.id), { inline: false })
