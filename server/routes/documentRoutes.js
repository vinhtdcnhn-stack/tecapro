import { Router } from 'express'
import {
  getFolderTree, createFolder, updateFolder, deleteFolder,
  getContractFiles, getFolderFiles, upload, uploadFile,
  downloadFile, viewFile, deleteFile,
  getFolderTreeIn, createFolderIn, getContractInFiles, uploadFileIn, uploadIn,
} from '../controllers/documentController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// Folder routes — ghi yêu cầu PM của HĐ (F-11)
router.get('/contracts/:contractId/folders', getFolderTree)
router.post('/contracts/:contractId/folders', pmFromParam(), createFolder)
router.put('/folders/:folderId', pmVia('folder', 'folderId'), updateFolder)
router.delete('/folders/:folderId', pmVia('folder', 'folderId'), deleteFolder)

// File routes (guard đặt TRƯỚC multer để request không có quyền không ghi file ra đĩa)
router.get('/contracts/:contractId/files', getContractFiles)
router.get('/folders/:folderId/files', getFolderFiles)
router.post('/contracts/:contractId/files/upload', pmFromParam(), upload.single('file'), uploadFile)
router.get('/files/:fileId/download', downloadFile)
router.get('/files/:fileId/view', viewFile)
router.delete('/files/:fileId', pmVia('file', 'fileId'), deleteFile)

// Contract_In document routes (same UI, different resource)
router.get('/contract-ins/:contractInId/folders',             getFolderTreeIn)
router.post('/contract-ins/:contractInId/folders',            pmVia('contractIn', 'contractInId'), createFolderIn)
router.get('/contract-ins/:contractInId/files',               getContractInFiles)
router.post('/contract-ins/:contractInId/files/upload',       pmVia('contractIn', 'contractInId'), uploadIn.single('file'), uploadFileIn)

export default router
