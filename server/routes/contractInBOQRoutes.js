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
import { getSupplyTargets, setLinksForInBoqRow } from '../controllers/supplyLinkController.js'
import { ownerOfContractIn, ownerVia, ownerViaBody } from '../middleware/contractAccess.js'

const router = Router()

const ownerOfCI = ownerOfContractIn('contractInId')

// Ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/purchase-boq/template',                                    downloadPurchaseBOQTemplate)
router.get('/contract-ins/:contractInId/boq',                           getPurchaseBOQ)
router.post('/contract-ins/:contractInId/boq',                          ownerOfCI, createPurchaseBOQItem)
router.post('/contract-ins/:contractInId/boq/after/:refId',             ownerOfCI, insertPurchaseBOQAfter)
router.post('/contract-ins/:contractInId/boq/import',    ownerOfCI, excelUploadIn.single('file'), importPurchaseBOQPreview)
router.post('/contract-ins/:contractInId/boq/save-import',              ownerOfCI, saveImportedPurchaseBOQ)
router.post('/contract-ins/:contractInId/boq/reorder',                  ownerOfCI, reorderPurchaseBOQ)
router.post('/purchase-boq/bulk-delete',                                ownerViaBody('inBoq'), bulkDeletePurchaseBOQItems)
router.put('/purchase-boq/:id',                                         ownerVia('inBoq'), updatePurchaseBOQItem)
router.delete('/purchase-boq/:id',                                      ownerVia('inBoq'), deletePurchaseBOQItem)

// Cột "Nhập cho": danh sách hàng bán/đầu nhập để chọn + gán ghép (nhiều đầu bán/dòng) cho 1 dòng.
router.get('/contract-ins/:contractInId/supply-targets',                getSupplyTargets)
router.put('/purchase-boq/:id/supply-links',                            ownerVia('inBoq'), setLinksForInBoqRow)

export default router
