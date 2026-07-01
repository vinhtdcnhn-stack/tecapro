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
import { contractPermFromParam, contractPermVia, contractPermViaBody } from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.boq.manage' // quyền ghi tab Bảng giá (RBAC lớp B; bootstrap = PM)

// Template download (no contractId needed)
router.get('/boq/template', downloadBOQTemplate)

// Collection routes — ghi yêu cầu quyền co.boq.manage trong HĐ
router.get('/contracts/:contractId/boq',                        getBOQ)
router.post('/contracts/:contractId/boq',         contractPermFromParam(M), createBOQItem)
router.post('/contracts/:contractId/boq/after/:refId', contractPermFromParam(M), insertBOQAfter)
router.post('/contracts/:contractId/boq/reorder', contractPermFromParam(M), reorderBOQ)
router.post('/contracts/:contractId/boq/import',  contractPermFromParam(M), excelUpload.single('file'), importBOQPreview)
router.post('/contracts/:contractId/boq/save-import', contractPermFromParam(M), saveImportedBOQ)

// Item routes
router.post('/boq/bulk-delete', contractPermViaBody(M, 'boq'), bulkDeleteBOQItems)
router.put('/boq/:id',    contractPermVia(M, 'boq'), updateBOQItem)
router.delete('/boq/:id', contractPermVia(M, 'boq'), deleteBOQItem)

export default router
