import { pool } from '../db.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'
import { buildTree } from './documentController.js'
import { cacheWrap } from '../cache.js'
import { tenderKey, invalidateTender } from '../services/cacheKeys.js'

const DOC_TTL = 30 * 60 // 30'

// ──────────────────────────────────────────────────────────────────────────────
// Tài liệu Hồ sơ mời thầu — dùng lại hệ thống thư mục/tệp của tài liệu HĐ
// (document_folder / document_file) nhưng khoá theo tender_id. Khác HĐ bán: CHO
// PHÉP tải tệp vào THƯ MỤC GỐC (folder_id NULL) → folderId rỗng/'root' = gốc.
//
// Sửa tên / xoá thư mục, xoá / xem / tải tệp dùng chung route toàn cục
// (/folders/:id, /files/:id…) trong documentController — docGuard đã nới cho gói thầu.
// ──────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

// Param id trong đường dẫn upload phải là số — chặn path traversal.
function numericIdOr(cb, raw) {
  const id = String(raw)
  if (!/^\d+$/.test(id)) { cb(new Error('ID không hợp lệ.')); return null }
  return id
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const tenderId = numericIdOr(cb, req.params.tenderId)
    if (tenderId === null) return
    const uploadDir = path.join(UPLOADS_ROOT, 'tenders', tenderId)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '_')
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  },
})

export const uploadTender = multer({ storage, limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

// ── Folder: GET tree ─────────────────────────────────────────────────────────

export async function getFolderTreeTender(req, res) {
  try {
    const { tenderId } = req.params
    const tree = await cacheWrap(tenderKey(tenderId, 'folders'), DOC_TTL, async () => {
      const { rows } = await pool.query(`
        WITH RECURSIVE folder_tree AS (
          SELECT id, tender_id, parent_id, folder_name, created_by, created_at,
                 0 AS level, ARRAY[id] AS path
          FROM public.document_folder
          WHERE tender_id = $1 AND parent_id IS NULL

          UNION ALL

          SELECT f.id, f.tender_id, f.parent_id, f.folder_name, f.created_by, f.created_at,
                 ft.level + 1, ft.path || f.id
          FROM public.document_folder f
          INNER JOIN folder_tree ft ON f.parent_id = ft.id
          WHERE f.tender_id = $1
        )
        SELECT * FROM folder_tree ORDER BY path
      `, [tenderId])
      return buildTree(rows)
    })
    res.json(tree)
  } catch (err) {
    console.error('getFolderTreeTender error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

// ── Folder: CREATE ───────────────────────────────────────────────────────────

export async function createFolderTender(req, res) {
  try {
    const { tenderId } = req.params
    const { folderName, parentId } = req.body
    if (!folderName?.trim()) return res.status(400).json({ error: 'Folder name is required' })
    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (tender_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [tenderId, parentId || null, folderName.trim(), req.user?.id || null])
    invalidateTender(tenderId, 'folders')
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createFolderTender error:', err)
    res.status(500).json({ error: 'Failed to create folder' })
  }
}

// ── File: GET list (folderId rỗng/'root' = thư mục gốc → folder_id IS NULL) ────

export async function getTenderFiles(req, res) {
  try {
    const { tenderId } = req.params
    const { folderId } = req.query
    const atRoot = !folderId || folderId === 'root'

    let query = `
      SELECT df.id, df.tender_id, df.folder_id, df.file_name, df.file_path,
             df.file_size, df.mime_type, df.uploaded_by, df.uploaded_at,
             u.full_name AS uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.tender_id = $1
    `
    const params = [tenderId]
    if (atRoot) {
      query += ' AND df.folder_id IS NULL'
    } else {
      query += ' AND df.folder_id = $2'
      params.push(folderId)
    }
    query += ' ORDER BY df.uploaded_at DESC'

    // Chỉ cache biến thể thư mục GỐC (lần nạp phổ biến); folder cụ thể thì query thẳng.
    const load = async () => (await pool.query(query, params)).rows
    const rows = atRoot
      ? await cacheWrap(tenderKey(tenderId, 'files'), DOC_TTL, load)
      : await load()
    res.json(rows)
  } catch (err) {
    console.error('getTenderFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}

// ── File: UPLOAD (cho phép gốc) ───────────────────────────────────────────────

export async function uploadFileTender(req, res) {
  try {
    const { tenderId } = req.params
    const { folderId } = req.body
    const atRoot = !folderId || folderId === 'root'

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Thư mục đích (nếu có) phải thuộc đúng gói thầu này.
    if (!atRoot) {
      const { rows: folderCheck } = await pool.query(
        'SELECT id FROM public.document_folder WHERE id = $1 AND tender_id = $2',
        [folderId, tenderId]
      )
      if (folderCheck.length === 0) {
        fs.unlinkSync(req.file.path)
        return res.status(404).json({ error: 'Folder not found or does not belong to this tender' })
      }
    }

    const filePath = `/uploads/tenders/${tenderId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const { rows } = await pool.query(`
      INSERT INTO public.document_file (tender_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [tenderId, atRoot ? null : folderId, fileName, filePath, req.file.size, req.file.mimetype, req.user?.id || null])

    invalidateTender(tenderId, 'files')
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadFileTender error:', err)
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path) } catch { /* best-effort cleanup */ }
    }
    res.status(500).json({ error: 'Failed to upload file' })
  }
}
