import { Router } from 'express'
import {
  getBOQ,
  createBOQItem,
  insertBOQAfter,
  reorderBOQ,
  updateBOQItem,
  deleteBOQItem,
  bulkDeleteBOQItems,
  importBOQPreview,
  saveImportedBOQ,
} from '../controllers/boqController.js'
import { downloadBOQTemplate, excelUpload } from '../controllers/boqExcel.js'
import { pmFromParam, pmVia, pmViaBody } from '../middleware/contractAccess.js'

const router = Router()

// Template download (no contractId needed)
router.get('/boq/template', downloadBOQTemplate)

// Collection routes — ghi yêu cầu PM của HĐ
router.get('/contracts/:contractId/boq',                        getBOQ)
router.post('/contracts/:contractId/boq',         pmFromParam(), createBOQItem)
router.post('/contracts/:contractId/boq/after/:refId', pmFromParam(), insertBOQAfter)
router.post('/contracts/:contractId/boq/reorder', pmFromParam(), reorderBOQ)
router.post('/contracts/:contractId/boq/import',  pmFromParam(), excelUpload.single('file'), importBOQPreview)
router.post('/contracts/:contractId/boq/save-import', pmFromParam(), saveImportedBOQ)

// Item routes
router.post('/boq/bulk-delete', pmViaBody('boq'), bulkDeleteBOQItems)
router.put('/boq/:id',    pmVia('boq'), updateBOQItem)
router.delete('/boq/:id', pmVia('boq'), deleteBOQItem)

export default router
