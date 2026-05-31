import db from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const contractId = req.params.contractId;
    const uploadDir = path.join(__dirname, '..', 'uploads', 'contracts', String(contractId));
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp_originalname
    const uniqueSuffix = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}_${originalName}`);
  }
});

// File filter to allow all file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

module.exports.upload = upload;

// Get folder tree for a contract
async function getFolderTree(req, res) {
  try {
    const { contractId } = req.params;
    
    const query = `
      WITH RECURSIVE folder_tree AS (
        SELECT 
          id,
          contract_id,
          parent_id,
          folder_name,
          created_by,
          created_at,
          is_deleted,
          0 as level,
          ARRAY[id] as path
        FROM public.document_folder
        WHERE contract_id = $1 AND parent_id IS NULL AND (is_deleted = false OR is_deleted IS NULL)
        
        UNION ALL
        
        SELECT 
          f.id,
          f.contract_id,
          f.parent_id,
          f.folder_name,
          f.created_by,
          f.created_at,
          f.is_deleted,
          ft.level + 1,
          ft.path || f.id
        FROM public.document_folder f
        INNER JOIN folder_tree ft ON f.parent_id = ft.id
        WHERE f.contract_id = $1 AND (f.is_deleted = false OR f.is_deleted IS NULL)
      )
      SELECT * FROM folder_tree
      ORDER BY path
    `;
    
    const result = await db.query(query, [contractId]);
    
    // Build tree structure
    const buildTree = (folders, parentId = null) => {
      return folders
        .filter(f => f.parent_id === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folders, folder.id)
        }));
    };
    
    const tree = buildTree(result.rows);
    res.json(tree);
  } catch (error) {
    console.error('Error getting folder tree:', error);
    res.status(500).json({ error: 'Failed to get folder tree' });
  }
}

// Create folder
async function createFolder(req, res) {
  console.log('===== CREATE FOLDER START =====')
  console.log('params=', req.params)
  console.log('body=', req.body)
  try {
    const { contractId } = req.params;
    const { folderName, parentId } = req.body;
    const userId = req.user?.id || 1; // TODO: Get from auth
    
    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    console.log('SQL params=', [
      contractId,
      parentId || null,
      folderName,
      userId
    ])
    
    const query = `
      INSERT INTO public.document_folder (contract_id, parent_id, folder_name, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await db.query(query, [contractId, parentId || null, folderName, userId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CREATE FOLDER ERROR=', error)
    res.status(500).json({ error: 'Failed to create folder' });
  }
}

// Update folder
async function updateFolder(req, res) {
  try {
    const { folderId } = req.params;
    const { folderName } = req.body;
    
    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const query = `
      UPDATE public.document_folder
      SET folder_name = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [folderName, folderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
}

// Delete folder (soft delete - set is_deleted = true)
async function deleteFolder(req, res) {
  try {
    const { folderId } = req.params;
    
    // Soft delete: set is_deleted = true instead of deleting
    const query = `
      UPDATE public.document_folder
      SET is_deleted = true
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [folderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
}

// Get files in a folder
async function getFolderFiles(req, res) {
  try {
    const { folderId } = req.params;
    
    const query = `
      SELECT 
        df.id,
        df.contract_id,
        df.folder_id,
        df.file_name,
        df.file_path,
        df.file_size,
        df.mime_type,
        df.uploaded_by,
        df.uploaded_at,
        u.full_name as uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.folder_id = $1
      ORDER BY df.uploaded_at DESC
    `;
    
    const result = await db.query(query, [folderId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting folder files:', error);
    res.status(500).json({ error: 'Failed to get folder files' });
  }
}

// Upload file to a folder
async function uploadFile(req, res) {
  try {
    const { contractId } = req.params;
    const { folderId } = req.body;
    const userId = req.user?.id || 1; // TODO: Get from auth
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!folderId) {
      // Clean up the uploaded file if folderId is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Folder ID is required' });
    }
    
    // Verify folder exists and belongs to the contract
    const folderQuery = 'SELECT id FROM public.document_folder WHERE id = $1 AND contract_id = $2';
    const folderResult = await db.query(folderQuery, [folderId, contractId]);
    
    if (folderResult.rows.length === 0) {
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Folder not found or does not belong to this contract' });
    }
    
    // Get relative file path for storage
    const filePath = `/uploads/contracts/${contractId}/${req.file.filename}`;
    
    // Create file record in database
    const query = `
      INSERT INTO public.document_file (contract_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      contractId,
      folderId,
      req.file.originalname,
      filePath,
      req.file.size,
      req.file.mimetype,
      userId
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up the uploaded file if database insert failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error cleaning up file:', e);
      }
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

// Delete file (soft delete - set is_deleted = true)
async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;
    
    // Soft delete: set is_deleted = true instead of deleting
    const query = `
      UPDATE public.document_file
      SET is_deleted = true
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

// Download file
async function downloadFile(req, res) {
  try {
    const { fileId } = req.params;
    
    const query = `
      SELECT * FROM public.document_file
      WHERE id = $1 AND is_deleted = false
    `;
    
    const result = await db.query(query, [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    
    // Construct absolute path to the file
    const filePath = path.join(__dirname, '..', file.file_path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Send file for download
    res.download(filePath, file.file_name);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}

// View file (for preview - especially PDF)
async function viewFile(req, res) {
  try {
    const { fileId } = req.params;
    
    const query = `
      SELECT * FROM public.document_file
      WHERE id = $1 AND is_deleted = false
    `;
    
    const result = await db.query(query, [fileId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    
    // Construct absolute path to the file
    const filePath = path.join(__dirname, '..', file.file_path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Send file for viewing (inline display)
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({ error: 'Failed to view file' });
  }
}

// Get all files for a contract (for the current selected folder)
async function getContractFiles(req, res) {
  try {
    const { contractId } = req.params;
    const { folderId } = req.query;
    
    let query = `
      SELECT 
        df.id,
        df.contract_id,
        df.folder_id,
        df.file_name,
        df.file_path,
        df.file_size,
        df.mime_type,
        df.uploaded_by,
        df.uploaded_at,
        u.full_name as uploaded_by_name
      FROM public.document_file df
      LEFT JOIN public.app_user u ON df.uploaded_by = u.id
      WHERE df.contract_id = $1 AND df.is_deleted = false
    `;
    
    const params = [contractId];
    
    if (folderId) {
      query += ' AND df.folder_id = $2';
      params.push(folderId);
    }
    
    query += ' ORDER BY df.uploaded_at DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting contract files:', error);
    res.status(500).json({ error: 'Failed to get contract files' });
  }
}

export {
  getFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderFiles,
  uploadFile,
  deleteFile,
  downloadFile,
  viewFile,
  getContractFiles,
  upload
};
