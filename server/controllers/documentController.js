import { pool } from '../db.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Multer storage ───────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'contracts', String(req.params.contractId))
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    // Sanitize filename — keep extension, replace special chars
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  }
})

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
})

// ── Multer storage for contract_in ───────────────────────────────────────────

const storageIn = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'contract-ins', String(req.params.contractInId))
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  }
})

export const uploadIn = multer({ storage: storageIn, limits: { fileSize: 50 * 1024 * 1024 } })

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build nested tree from flat array.
// document_folder.id is integer (pg → JS number)
// document_folder.parent_id is bigint (pg → JS string)
// Must use loose comparison to match them.
function buildTree(folders, parentId = null) {
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

function resolveFilePath(storedPath) {
  return path.join(__dirname, '..', storedPath)
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

    res.json(buildTree(rows))
  } catch (err) {
    console.error('getFolderTree error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

// ── Folder: CREATE ───────────────────────────────────────────────────────────

export async function createFolder(req, res) {
  try {
    const { contractId } = req.params
    const { folderName, parentId, userId } = req.body

    if (!folderName?.trim()) {
      return res.status(400).json({ error: 'Folder name is required' })
    }

    const createdBy = userId || req.user?.id || null

    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [contractId, parentId || null, folderName.trim(), createdBy])

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
    const { folderId, userId } = req.body

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

    const uploadedBy = userId || req.user?.id || null
    const filePath = `/uploads/contracts/${contractId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const { rows } = await pool.query(`
      INSERT INTO public.document_file (contract_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [contractId, folderId, fileName, filePath, req.file.size, req.file.mimetype, uploadedBy])

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadFile error:', err)
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path) } catch {}
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

    res.download(filePath, file.file_name)
  } catch (err) {
    console.error('downloadFile error:', err)
    res.status(500).json({ error: 'Failed to download file' })
  }
}

// ── Contract_In document functions ───────────────────────────────────────────

export async function getFolderTreeIn(req, res) {
  try {
    const { contractInId } = req.params
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
    res.json(buildTree(rows))
  } catch (err) {
    console.error('getFolderTreeIn error:', err)
    res.status(500).json({ error: 'Failed to get folder tree' })
  }
}

export async function createFolderIn(req, res) {
  try {
    const { contractInId } = req.params
    const { folderName, parentId, userId } = req.body
    if (!folderName?.trim()) return res.status(400).json({ error: 'Folder name is required' })
    const { rows } = await pool.query(`
      INSERT INTO public.document_folder (contract_in_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [contractInId, parentId || null, folderName.trim(), userId || null])
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
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('getContractInFiles error:', err)
    res.status(500).json({ error: 'Failed to get files' })
  }
}

export async function uploadFileIn(req, res) {
  try {
    const { contractInId } = req.params
    const { folderId, userId } = req.body
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
    `, [contractInId, folderId, fileName, filePath, req.file.size, req.file.mimetype, userId || null])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('uploadFileIn error:', err)
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch {} }
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

    res.sendFile(filePath)
  } catch (err) {
    console.error('viewFile error:', err)
    res.status(500).json({ error: 'Failed to view file' })
  }
}
