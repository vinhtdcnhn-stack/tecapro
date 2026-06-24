import { Router } from 'express'
import {
  getFolderTree, createFolder, updateFolder, deleteFolder,
  getContractFiles, getFolderFiles, upload, uploadFile,
  downloadFile, downloadFolder, viewFile, deleteFile,
  getFolderTreeIn, createFolderIn, getContractInFiles, uploadFileIn, uploadIn,
} from '../controllers/documentController.js'
import { pmFromParam, docGuard, ownerOfContractIn } from '../middleware/contractAccess.js'

const router = Router()

// Folder/file dùng chung HĐ bán + HĐ nhập: docGuard tự phân nhánh PM (HĐ bán) /
// người tạo (HĐ nhập). Tạo mới gắn thẳng vào HĐ cha nên dùng guard theo từng loại.
router.get('/contracts/:contractId/folders', getFolderTree)
router.post('/contracts/:contractId/folders', pmFromParam(), createFolder)
router.put('/folders/:folderId', docGuard('folder', 'folderId'), updateFolder)
router.delete('/folders/:folderId', docGuard('folder', 'folderId'), deleteFolder)

// File routes (guard đặt TRƯỚC multer để request không có quyền không ghi file ra đĩa)
router.get('/contracts/:contractId/files', getContractFiles)
router.get('/folders/:folderId/files', getFolderFiles)
router.get('/folders/:folderId/download', downloadFolder)   // zip cả cây thư mục (HĐ + Đấu thầu)
router.post('/contracts/:contractId/files/upload', pmFromParam(), upload.single('file'), uploadFile)
router.get('/files/:fileId/download', downloadFile)
router.get('/files/:fileId/view', viewFile)
router.delete('/files/:fileId', docGuard('file', 'fileId'), deleteFile)

// Contract_In document routes (same UI, different resource) — ghi: người tạo HĐ nhập
router.get('/contract-ins/:contractInId/folders',             getFolderTreeIn)
router.post('/contract-ins/:contractInId/folders',            ownerOfContractIn('contractInId'), createFolderIn)
router.get('/contract-ins/:contractInId/files',               getContractInFiles)
router.post('/contract-ins/:contractInId/files/upload',       ownerOfContractIn('contractInId'), uploadIn.single('file'), uploadFileIn)

export default router
