import { Router } from 'express'
import {
  getFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
  getContractFiles,
  getFolderFiles,
  upload,
  uploadFile,
  downloadFile,
  viewFile,
  deleteFile,
} from '../controllers/documentController.js'

const router = Router()

// Folder routes
router.get('/contracts/:contractId/folders', getFolderTree)
router.post('/contracts/:contractId/folders', createFolder)
router.put('/folders/:folderId', updateFolder)
router.delete('/folders/:folderId', deleteFolder)

// File routes
router.get('/contracts/:contractId/files', getContractFiles)
router.get('/folders/:folderId/files', getFolderFiles)
router.post('/contracts/:contractId/files/upload', upload.single('file'), uploadFile)
router.get('/files/:fileId/download', downloadFile)
router.get('/files/:fileId/view', viewFile)
router.delete('/files/:fileId', deleteFile)

export default router
