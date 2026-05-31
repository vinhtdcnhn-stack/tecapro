import { Router } from 'express'
import * as documentController from '../controllers/documentController.js'

const router = Router()

// Folder routes
router.get('/contracts/:contractId/folders', documentController.getFolderTree)
router.post('/contracts/:contractId/folders', documentController.createFolder)
router.put('/folders/:folderId', documentController.updateFolder)
router.delete('/folders/:folderId', documentController.deleteFolder)

// File routes
router.get('/contracts/:contractId/files', documentController.getContractFiles)
router.get('/folders/:folderId/files', documentController.getFolderFiles)
router.post('/contracts/:contractId/files/upload', documentController.upload.single('file'), documentController.uploadFile)
router.get('/files/:id/download', documentController.downloadFile)
router.get('/files/:id/view', documentController.viewFile)
router.delete('/files/:id', documentController.deleteFile)

export default router
