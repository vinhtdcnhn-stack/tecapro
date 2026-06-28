import { pool } from '../db.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { fileURLToPath } from 'url'
import { safeUploadFilter, UPLOAD_LIMITS, BLOCKED_EXT } from '../middleware/uploadFilter.js'
import { cacheWrap } from '../cache.js'
import {
  contractKey, contractInKey, invalidateContract, invalidateContractIn, invalidateTender,
} from '../services/cacheKeys.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOC_TTL = 30 * 60 // 30'

// Thư mục/tệp đổi → tab folders + files của đúng chủ sở hữu: HĐ bán (contract_id),
// HĐ nhập (contract_in_id) hoặc gói thầu (tender_id). Rename/xóa folder, xóa file của
// gói thầu đi qua route global của controller này nên phải phủ cả tender_id.
function invalidateDocRow(row) {
  if (row?.contract_id != null) invalidateContract(row.contract_id, 'folders', 'files')
  if (row?.contract_in_id != null) invalidateContractIn(row.contract_in_id, 'folders', 'files')
  if (row?.tender_id != null) invalidateTender(row.tender_id, 'folders', 'files')
}

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

// Param id trong đường dẫn upload phải là số — chặn path traversal kiểu `..%2F..%2F`
// (Express decode %2F trong param trước khi đưa vào path.join).
function numericIdOr(cb, raw) {
  const id = String(raw)
  if (!/^\d+$/.test(id)) {
    cb(new Error('ID không hợp lệ.'))
    return null
  }
  return id
}

// ── Multer storage ───────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const contractId = numericIdOr(cb, req.params.contractId)
    if (contractId === null) return
    const uploadDir = path.join(UPLOADS_ROOT, 'contracts', contractId)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    // Sanitize filename — keep extension, replace special chars
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '_')
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  }
})

export const upload = multer({
  storage,
  limits: UPLOAD_LIMITS,
  fileFilter: safeUploadFilter,
})

// ── Multer storage for contract_in ───────────────────────────────────────────

const storageIn = multer.diskStorage({
  destination(req, file, cb) {
    const contractInId = numericIdOr(cb, req.params.contractInId)
    if (contractInId === null) return
    const uploadDir = path.join(UPLOADS_ROOT, 'contract-ins', contractInId)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '_')
    const base = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  }
})

export const uploadIn = multer({ storage: storageIn, limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build nested tree from flat array.
// document_folder.id is integer (pg → JS number)
// document_folder.parent_id is bigint (pg → JS string)
// Must use loose comparison to match them.
export function buildTree(folders, parentId = null) {
  return folders
    .filter(f => {
      if (parentId === null) return f.parent_id === null
      return String(f.parent_id) === String(parentId)
    })
    .map(folder => ({
      ...folder,
      children: buildTree(folders, folder.id)
    }))
}

// file_path chỉ do server tự ghi vào DB, nhưng vẫn normalize + chặn thoát khỏi uploads/ (defense-in-depth)
function resolveFilePath(storedPath) {
  const abs = path.resolve(path.join(__dirname, '..', String(storedPath)))
  if (abs !== UPLOADS_ROOT && !abs.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error(`file_path nằm ngoài thư mục uploads: ${storedPath}`)
  }
  return abs
}

function deleteFileFromDisk(storedPath) {
  try {
    const abs = resolveFilePath(storedPath)
    if (fs.existsSync(abs)) fs.unlinkSync(abs)
  } catch {
    // ignore disk errors — DB record will still be removed
  }
}

// ── Folder: GET tree ─────────────────────────────────────────────────────────

export async function getFolderTree(req, res) {
  try {
    const { contractId } = req.params

    const tree = await cacheWrap(contractKey(contractId, 'folders'), DOC_TTL, async () => {
      // Recursive CTE to fetch all folders for this contract in tree order.
      // No is_deleted column in schema — filter is omitted.
      const { rows } = await pool.query(`
        WITH RECURSIVE folder_tree AS (
          SELECT id, contract_id, parent_id, folder_name, created_by, created_at,
                 0 AS level, ARRAY[id] AS path
          FROM public.document_folder
          WHERE contract_id = $1 AND parent_id IS NULL

          UNION ALL

          SELECT f.id, f.contract_id, f.parent_id, f.folder_name, f.created_by, f.created_at,
                 ft.level + 1, ft.path || f.id
          FROM public.document_folder f
          INNER JOIN folder_tree ft ON f.parent_id = ft.id
          WHERE f.contract_id = $1
        )
        SELECT * FROM folder_tree ORDER BY path
      `, [contractId])
      return buildTree(rows)
    })

    res.json(tree)
  } catch (err) {
    console.error('getFolderTree error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

// ── Folder: CREATE ───────────────────────────────────────────────────────────

export async function createFolder(req, res) {
  try {
    const { contractId } = req.params
    const { folderName, parentId } = req.body

    if (!folderName?.trim()) {
      return res.status(400).json({ error: 'Folder name is required' })
    }

    // Người tạo lấy từ phiên đã xác thực (không tin id do client gửi).
    const createdBy = req.user?.id || null

    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [contractId, parentId || null, folderName.trim(), createdBy])

    invalidateDocRow(rows[0])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createFolder error:', err)
    res.status(500).json({ error: 'Failed to create folder' })
  }
}

// ── Folder: RENAME ───────────────────────────────────────────────────────────

export async function updateFolder(req, res) {
  try {
    const { folderId } = req.params
    const { folderName } = req.body

    if (!folderName?.trim()) {
      return res.status(400).json({ error: 'Folder name is required' })
    }

    const { rows } = await pool.query(`
      UPDATE public.document_folder SET folder_name = $1 WHERE id = $2 RETURNING *
    `, [folderName.trim(), folderId])

    if (rows.length === 0) return res.status(404).json({ error: 'Folder not found' })
    invalidateDocRow(rows[0])
    res.json(rows[0])
  } catch (err) {
    console.error('updateFolder error:', err)
    res.status(500).json({ error: 'Failed to update folder' })
  }
}

// ── Folder: DELETE (hard delete, cascade subtree) ────────────────────────────

export async function deleteFolder(req, res) {
  try {
    const { folderId } = req.params

    // HĐ/gói sở hữu thư mục (để invalidate đúng tab sau khi xóa).
    const { rows: own } = await pool.query(
      'SELECT contract_id, contract_in_id, tender_id FROM public.document_folder WHERE id = $1', [folderId])

    // Collect all folder IDs in the subtree (including the target folder)
    const { rows: subtree } = await pool.query(`
      WITH RECURSIVE subtree AS (
        SELECT id FROM public.document_folder WHERE id = $1
        UNION ALL
        SELECT f.id FROM public.document_folder f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      SELECT id FROM subtree
    `, [folderId])

    if (subtree.length === 0) return res.status(404).json({ error: 'Folder not found' })

    const folderIds = subtree.map(r => r.id)

    // Get file paths before deleting so we can clean up disk
    const { rows: fileRows } = await pool.query(
      'SELECT file_path FROM public.document_file WHERE folder_id = ANY($1)',
      [folderIds]
    )

    // Delete physical files
    fileRows.forEach(f => deleteFileFromDisk(f.file_path))

    // Delete DB records — files first (child), then folders (parent)
    await pool.query('DELETE FROM public.document_file WHERE folder_id = ANY($1)', [folderIds])
    await pool.query('DELETE FROM public.document_folder WHERE id = ANY($1)', [folderIds])

    invalidateDocRow(own[0])
    res.json({ message: 'Folder deleted' })
  } catch (err) {
    console.error('deleteFolder error:', err)
    res.status(500).json({ error: 'Failed to delete folder' })
  }
}

// ── File: GET list for a folder (via contract) ───────────────────────────────

export async function getContractFiles(req, res) {
  try {
    const { contractId } = req.params
    const { folderId } = req.query

    const load = async () => {
      let query = `
        SELECT df.id, df.contract_id, df.folder_id, df.file_name, df.file_path,
               df.file_size, df.mime_type, df.uploaded_by, df.uploaded_at,
               u.full_name AS uploaded_by_name
        FROM public.document_file df
        LEFT JOIN public.app_user u ON df.uploaded_by = u.id
        WHERE df.contract_id = $1
      `
      const params = [contractId]
      if (folderId) {
        query += ' AND df.folder_id = $2'
        params.push(folderId)
      }
      query += ' ORDER BY df.uploaded_at DESC'
      const { rows } = await pool.query(query, params)
      return rows
    }

    // Chỉ cache biến thể "toàn bộ tệp HĐ" (không lọc folderId) — đây là lần nạp phổ biến.
    const rows = folderId
      ? await load()
      : await cacheWrap(contractKey(contractId, 'files'), DOC_TTL, load)
    res.json(rows)
  } catch (err) {
    console.error('getContractFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}

// ── File: GET list for a specific folder ─────────────────────────────────────

export async function getFolderFiles(req, res) {
  try {
    const { folderId } = req.params

    const { rows } = await pool.query(`
      SELECT df.id, df.contract_id, df.folder_id, df.file_name, df.file_path,
             df.file_size, df.mime_type, df.uploaded_by, df.uploaded_at,
             u.full_name AS uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.folder_id = $1
      ORDER BY df.uploaded_at DESC
    `, [folderId])

    res.json(rows)
  } catch (err) {
    console.error('getFolderFiles error:', err)
    res.status(500).json({ error: 'Failed to get folder files' })
  }
}

// ── File: UPLOAD ─────────────────────────────────────────────────────────────

export async function uploadFile(req, res) {
  try {
    const { contractId } = req.params
    const { folderId } = req.body

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!folderId) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Folder ID is required' })
    }

    // Verify folder belongs to this contract
    const { rows: folderCheck } = await pool.query(
      'SELECT id FROM public.document_folder WHERE id = $1 AND contract_id = $2',
      [folderId, contractId]
    )
    if (folderCheck.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Folder not found or does not belong to this contract' })
    }

    // Người upload lấy từ phiên đã xác thực (không tin id do client gửi).
    const uploadedBy = req.user?.id || null
    const filePath = `/uploads/contracts/${contractId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const { rows } = await pool.query(`
      INSERT INTO public.document_file (contract_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [contractId, folderId, fileName, filePath, req.file.size, req.file.mimetype, uploadedBy])

    invalidateDocRow(rows[0])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadFile error:', err)
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path) } catch { /* best-effort cleanup */ }
    }
    res.status(500).json({ error: 'Failed to upload file' })
  }
}

// ── File: DELETE (hard delete + disk cleanup) ─────────────────────────────────

export async function deleteFile(req, res) {
  try {
    const { fileId } = req.params

    // Get the record first so we know the disk path
    const { rows } = await pool.query(
      'SELECT * FROM public.document_file WHERE id = $1',
      [fileId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const file = rows[0]

    // Remove from disk
    deleteFileFromDisk(file.file_path)

    // Remove from DB
    await pool.query('DELETE FROM public.document_file WHERE id = $1', [fileId])

    invalidateDocRow(file)
    res.json({ message: 'File deleted' })
  } catch (err) {
    console.error('deleteFile error:', err)
    res.status(500).json({ error: 'Failed to delete file' })
  }
}

// ── File: DOWNLOAD ────────────────────────────────────────────────────────────

export async function downloadFile(req, res) {
  try {
    const { fileId } = req.params

    const { rows } = await pool.query(
      'SELECT * FROM public.document_file WHERE id = $1',
      [fileId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const file = rows[0]
    const filePath = resolveFilePath(file.file_path)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' })
    }

    res.setHeader('X-Content-Type-Options', 'nosniff') // chặn trình duyệt "đoán" kiểu nội dung
    res.download(filePath, file.file_name)
  } catch (err) {
    console.error('downloadFile error:', err)
    res.status(500).json({ error: 'Failed to download file' })
  }
}

// ── Folder: DOWNLOAD (zip toàn bộ cây thư mục) ────────────────────────────────
// Generic theo folder_id nên dùng chung cho HĐ bán / HĐ nhập / đầu việc Đấu thầu
// (đều dùng chung bảng document_file, document_folder). Giữ cấu trúc thư mục con
// bên trong file zip. Không gắn guard riêng — đồng bộ với /files/:fileId/download.
export async function downloadFolder(req, res) {
  try {
    const { folderId } = req.params

    // Thư mục gốc (để đặt tên file zip + kiểm tra tồn tại)
    const { rows: rootRows } = await pool.query(
      'SELECT id, folder_name FROM public.document_folder WHERE id = $1',
      [folderId]
    )
    if (rootRows.length === 0) return res.status(404).json({ error: 'Folder not found' })
    const rootName = rootRows[0].folder_name

    // Cây con: mỗi thư mục kèm rel_path = tiền tố đường dẫn cho file BÊN TRONG nó.
    // Thư mục gốc → '' (file nằm ở gốc zip); thư mục con → 'Tên con/...'.
    const { rows: folders } = await pool.query(`
      WITH RECURSIVE subtree AS (
        SELECT id, ''::text AS rel_path
        FROM public.document_folder WHERE id = $1
        UNION ALL
        SELECT f.id, s.rel_path || f.folder_name || '/'
        FROM public.document_folder f
        INNER JOIN subtree s ON f.parent_id = s.id
      )
      SELECT id, rel_path FROM subtree
    `, [folderId])

    const relById = new Map(folders.map(f => [String(f.id), f.rel_path]))
    const folderIds = folders.map(f => f.id)

    const { rows: files } = await pool.query(
      'SELECT folder_id, file_name, file_path FROM public.document_file WHERE folder_id = ANY($1)',
      [folderIds]
    )

    // Lọc các file thực sự còn trên đĩa
    const present = files
      .map(f => {
        try {
          const abs = resolveFilePath(f.file_path)
          if (!fs.existsSync(abs)) return null
          return { abs, name: (relById.get(String(f.folder_id)) || '') + f.file_name }
        } catch { return null }
      })
      .filter(Boolean)

    if (present.length === 0) {
      return res.status(404).json({ error: 'Thư mục không có tệp nào để tải.' })
    }

    const safeZipName = rootName.replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'folder'
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeZipName)}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', err => {
      console.error('downloadFolder archive error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Failed to zip folder' })
      else res.destroy(err)
    })
    archive.pipe(res)

    // Tránh trùng tên trong cùng một thư mục zip
    const used = new Set()
    for (const f of present) {
      let entry = f.name
      if (used.has(entry)) {
        const dir = path.posix.dirname(entry)
        const ext = path.extname(entry)
        const base = path.basename(entry, ext)
        let i = 1
        do { entry = `${dir === '.' ? '' : dir + '/'}${base} (${i++})${ext}` } while (used.has(entry))
      }
      used.add(entry)
      archive.file(f.abs, { name: entry })
    }

    await archive.finalize()
  } catch (err) {
    console.error('downloadFolder error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download folder' })
  }
}

// ── Contract_In document functions ───────────────────────────────────────────

export async function getFolderTreeIn(req, res) {
  try {
    const { contractInId } = req.params
    const tree = await cacheWrap(contractInKey(contractInId, 'folders'), DOC_TTL, async () => {
      const { rows } = await pool.query(`
        WITH RECURSIVE folder_tree AS (
          SELECT id, contract_in_id, parent_id, folder_name, created_by, created_at,
                 0 AS level, ARRAY[id] AS path
          FROM public.document_folder
          WHERE contract_in_id = $1 AND parent_id IS NULL

          UNION ALL

          SELECT f.id, f.contract_in_id, f.parent_id, f.folder_name, f.created_by, f.created_at,
                 ft.level + 1, ft.path || f.id
          FROM public.document_folder f
          INNER JOIN folder_tree ft ON f.parent_id = ft.id
          WHERE f.contract_in_id = $1
        )
        SELECT * FROM folder_tree ORDER BY path
      `, [contractInId])
      return buildTree(rows)
    })
    res.json(tree)
  } catch (err) {
    console.error('getFolderTreeIn error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

export async function createFolderIn(req, res) {
  try {
    const { contractInId } = req.params
    const { folderName, parentId } = req.body
    if (!folderName?.trim()) return res.status(400).json({ error: 'Folder name is required' })
    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (contract_in_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [contractInId, parentId || null, folderName.trim(), req.user?.id || null])
    invalidateDocRow(rows[0])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createFolderIn error:', err)
    res.status(500).json({ error: 'Failed to create folder' })
  }
}

export async function getContractInFiles(req, res) {
  try {
    const { contractInId } = req.params
    const { folderId } = req.query
    let query = `
      SELECT df.id, df.contract_in_id, df.folder_id, df.file_name, df.file_path,
             df.file_size, df.mime_type, df.uploaded_by, df.uploaded_at,
             u.full_name AS uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.contract_in_id = $1
    `
    const params = [contractInId]
    if (folderId) { query += ' AND df.folder_id = $2'; params.push(folderId) }
    query += ' ORDER BY df.uploaded_at DESC'
    const load = async () => (await pool.query(query, params)).rows
    const rows = folderId
      ? await load()
      : await cacheWrap(contractInKey(contractInId, 'files'), DOC_TTL, load)
    res.json(rows)
  } catch (err) {
    console.error('getContractInFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}

export async function uploadFileIn(req, res) {
  try {
    const { contractInId } = req.params
    const { folderId } = req.body
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (!folderId) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Folder ID is required' })
    }
    const { rows: folderCheck } = await pool.query(
      'SELECT id FROM public.document_folder WHERE id = $1 AND contract_in_id = $2',
      [folderId, contractInId]
    )
    if (folderCheck.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Folder not found' })
    }
    const filePath = `/uploads/contract-ins/${contractInId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const { rows } = await pool.query(`
      INSERT INTO public.document_file (contract_in_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [contractInId, folderId, fileName, filePath, req.file.size, req.file.mimetype, req.user?.id || null])
    invalidateDocRow(rows[0])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadFileIn error:', err)
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* best-effort cleanup */ } }
    res.status(500).json({ error: 'Failed to upload file' })
  }
}

// ── File: VIEW (inline preview) ───────────────────────────────────────────────

export async function viewFile(req, res) {
  try {
    const { fileId } = req.params

    const { rows } = await pool.query(
      'SELECT * FROM public.document_file WHERE id = $1',
      [fileId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const file = rows[0]
    const filePath = resolveFilePath(file.file_path)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' })
    }

    // nosniff: với preview inline, không cho trình duyệt suy diễn kiểu nội dung khác kiểu thật.
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // File cũ upload trước khi có blocklist có thể là HTML/SVG → không render inline, ép tải về.
    const ext = path.extname(filePath).toLowerCase()
    if (BLOCKED_EXT.has(ext)) {
      res.download(filePath, file.file_name)
      return
    }
    res.sendFile(filePath)
  } catch (err) {
    console.error('viewFile error:', err)
    res.status(500).json({ error: 'Failed to view file' })
  }
}
