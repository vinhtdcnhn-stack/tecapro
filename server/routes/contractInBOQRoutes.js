import { Router } from 'express'
import {
  excelUploadIn,
  downloadPurchaseBOQTemplate,
  getPurchaseBOQ,
  createPurchaseBOQItem,
  insertPurchaseBOQAfter,
  updatePurchaseBOQItem,
  deletePurchaseBOQItem,
  importPurchaseBOQPreview,
  saveImportedPurchaseBOQ,
  reorderPurchaseBOQ,
  bulkDeletePurchaseBOQItems,
} from '../controllers/contractInBOQController.js'
import { pmVia, pmViaBody } from '../middleware/contractAccess.js'

const router = Router()

const pmOfContractIn = pmVia('contractIn', 'contractInId')

// Ghi yêu cầu PM của HĐ bán cha (F-11)
router.get('/purchase-boq/template',                                    downloadPurchaseBOQTemplate)
router.get('/contract-ins/:contractInId/boq',                           getPurchaseBOQ)
router.post('/contract-ins/:contractInId/boq',                          pmOfContractIn, createPurchaseBOQItem)
router.post('/contract-ins/:contractInId/boq/after/:refId',             pmOfContractIn, insertPurchaseBOQAfter)
router.post('/contract-ins/:contractInId/boq/import',    pmOfContractIn, excelUploadIn.single('file'), importPurchaseBOQPreview)
router.post('/contract-ins/:contractInId/boq/save-import',              pmOfContractIn, saveImportedPurchaseBOQ)
router.post('/contract-ins/:contractInId/boq/reorder',                  pmOfContractIn, reorderPurchaseBOQ)
router.post('/purchase-boq/bulk-delete',                                pmViaBody('inBoq'), bulkDeletePurchaseBOQItems)
router.put('/purchase-boq/:id',                                         pmVia('inBoq'), updatePurchaseBOQItem)
router.delete('/purchase-boq/:id',                                      pmVia('inBoq'), deletePurchaseBOQItem)

export default router
