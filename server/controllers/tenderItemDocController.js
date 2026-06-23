import { pool } from '../db.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { safeUploadFilter, UPLOAD_LIMITS } from '../middleware/uploadFilter.js'
import { buildTree } from './documentController.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tệp SẢN PHẨM của đầu việc checklist — dùng lại document_folder / document_file
// nhưng khoá theo item_id (tender_id/contract_id để NULL → không lẫn với Hồ sơ mời
// thầu). Cho phép tải tệp vào THƯ MỤC GỐC (folder_id NULL) → folderId rỗng/'root'.
//
// Sửa tên / xoá thư mục, xoá / xem / tải tệp dùng chung route toàn cục
// (/folders/:id, /files/:id…) trong documentController — docGuard đã nới cho item.
//
// Ngoài ra phục vụ ĐỌC Hồ sơ mời thầu (đầu vào của gói) cho người được giao việc
// không thuộc Ban Đấu thầu: tra ngược tender_id từ item rồi trả thư mục/tệp gói.
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
    const itemId = numericIdOr(cb, req.params.itemId)
    if (itemId === null) return
    const uploadDir = path.join(UPLOADS_ROOT, 'tender', 'items', itemId)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '_')
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  },
})

export const uploadTenderItem = multer({ storage, limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

// ── Thư mục sản phẩm: GET cây ─────────────────────────────────────────────────

export async function getItemFolders(req, res) {
  try {
    const { itemId } = req.params
    const { rows } = await pool.query(`
      WITH RECURSIVE folder_tree AS (
        SELECT id, item_id, parent_id, folder_name, created_by, created_at,
               0 AS level, ARRAY[id] AS path
        FROM public.document_folder
        WHERE item_id = $1 AND parent_id IS NULL

        UNION ALL

        SELECT f.id, f.item_id, f.parent_id, f.folder_name, f.created_by, f.created_at,
               ft.level + 1, ft.path || f.id
        FROM public.document_folder f
        INNER JOIN folder_tree ft ON f.parent_id = ft.id
        WHERE f.item_id = $1
      )
      SELECT * FROM folder_tree ORDER BY path
    `, [itemId])
    res.json(buildTree(rows))
  } catch (err) {
    console.error('getItemFolders error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

// ── Thư mục sản phẩm: CREATE ──────────────────────────────────────────────────

export async function createItemFolder(req, res) {
  try {
    const { itemId } = req.params
    const { folderName, parentId } = req.body
    if (!folderName?.trim()) return res.status(400).json({ error: 'Folder name is required' })
    // Thư mục cha (nếu có) phải thuộc đúng đầu việc này.
    if (parentId) {
      const { rows: chk } = await pool.query(
        'SELECT id FROM public.document_folder WHERE id = $1 AND item_id = $2', [parentId, itemId])
      if (chk.length === 0) return res.status(404).json({ error: 'Parent folder not found' })
    }
    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (item_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [itemId, parentId || null, folderName.trim(), req.user?.id || null])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createItemFolder error:', err)
    res.status(500).json({ error: 'Failed to create folder' })
  }
}

// ── Tệp sản phẩm: GET (flat=1 → mọi tệp của đầu việc kèm tên thư mục; ngược lại
//    theo folderId, rỗng/'root' = thư mục gốc) ─────────────────────────────────

export async function getItemFiles(req, res) {
  try {
    const { itemId } = req.params
    const { folderId, flat } = req.query

    let query = `
      SELECT df.id, df.item_id, df.folder_id, df.file_name, df.file_path,
             df.file_size, df.mime_type, df.uploaded_by, df.uploaded_at,
             f.folder_name, u.full_name AS uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.document_folder f ON f.id = df.folder_id
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.item_id = $1
    `
    const params = [itemId]
    if (flat !== '1' && flat !== 'true') {
      const atRoot = !folderId || folderId === 'root'
      if (atRoot) {
        query += ' AND df.folder_id IS NULL'
      } else {
        query += ' AND df.folder_id = $2'
        params.push(folderId)
      }
    }
    query += ' ORDER BY df.uploaded_at DESC'

    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('getItemFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}

// ── Tệp sản phẩm: UPLOAD (cho phép gốc) ───────────────────────────────────────

export async function uploadItemDoc(req, res) {
  try {
    const { itemId } = req.params
    const { folderId } = req.body
    const atRoot = !folderId || folderId === 'root'

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Thư mục đích (nếu có) phải thuộc đúng đầu việc này.
    if (!atRoot) {
      const { rows: folderCheck } = await pool.query(
        'SELECT id FROM public.document_folder WHERE id = $1 AND item_id = $2',
        [folderId, itemId]
      )
      if (folderCheck.length === 0) {
        fs.unlinkSync(req.file.path)
        return res.status(404).json({ error: 'Folder not found or does not belong to this item' })
      }
    }

    const filePath = `/uploads/tender/items/${itemId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const { rows } = await pool.query(`
      INSERT INTO public.document_file (item_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [itemId, atRoot ? null : folderId, fileName, filePath, req.file.size, req.file.mimetype, req.user?.id || null])

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadItemDoc error:', err)
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path) } catch { /* best-effort cleanup */ }
    }
    res.status(500).json({ error: 'Failed to upload file' })
  }
}

// ── Hồ sơ mời thầu (đầu vào) — CHỈ ĐỌC cho người được giao việc ───────────────
// Tra tender_id từ đầu việc rồi trả thư mục/tệp của gói (như tab Hồ sơ mời thầu).

async function tenderIdOfItem(itemId) {
  const { rows } = await pool.query(
    'SELECT tender_id FROM tender_checklist_item WHERE id = $1', [itemId])
  return rows[0]?.tender_id ?? null
}

export async function getItemInvitationFolders(req, res) {
  try {
    const tenderId = await tenderIdOfItem(req.params.itemId)
    if (!tenderId) return res.json([])
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
    res.json(buildTree(rows))
  } catch (err) {
    console.error('getItemInvitationFolders error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

export async function getItemInvitationFiles(req, res) {
  try {
    const tenderId = await tenderIdOfItem(req.params.itemId)
    if (!tenderId) return res.json([])
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
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('getItemInvitationFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}
