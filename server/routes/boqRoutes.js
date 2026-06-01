import { Router } from 'express'
import {
  getBOQ,
  createBOQItem,
  insertBOQAfter,
  updateBOQItem,
  deleteBOQItem,
  importBOQPreview,
  saveImportedBOQ,
  downloadBOQTemplate,
  excelUpload,
} from '../controllers/boqController.js'

const router = Router()

// Template download (no contractId needed)
router.get('/boq/template', downloadBOQTemplate)

// Collection routes
router.get('/contracts/:contractId/boq',                        getBOQ)
router.post('/contracts/:contractId/boq',                       createBOQItem)
router.post('/contracts/:contractId/boq/after/:refId',          insertBOQAfter)
router.post('/contracts/:contractId/boq/import',  excelUpload.single('file'), importBOQPreview)
router.post('/contracts/:contractId/boq/save-import',           saveImportedBOQ)

// Item routes
router.put('/boq/:id',    updateBOQItem)
router.delete('/boq/:id', deleteBOQItem)

export default router
