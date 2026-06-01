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
} from '../controllers/contractInBOQController.js'

const router = Router()

router.get('/purchase-boq/template',                                    downloadPurchaseBOQTemplate)
router.get('/contract-ins/:contractInId/boq',                           getPurchaseBOQ)
router.post('/contract-ins/:contractInId/boq',                          createPurchaseBOQItem)
router.post('/contract-ins/:contractInId/boq/after/:refId',             insertPurchaseBOQAfter)
router.post('/contract-ins/:contractInId/boq/import',    excelUploadIn.single('file'), importPurchaseBOQPreview)
router.post('/contract-ins/:contractInId/boq/save-import',              saveImportedPurchaseBOQ)
router.put('/purchase-boq/:id',                                         updatePurchaseBOQItem)
router.delete('/purchase-boq/:id',                                      deletePurchaseBOQItem)

export default router
