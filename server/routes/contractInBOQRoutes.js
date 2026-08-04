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
import { getTargets, getTargetCandidates, addTarget, removeTarget } from '../controllers/contractInTargetController.js'
import {
  ownerOfContractIn, ownerVia, ownerViaBody, requireTargetsManager, canLinkSupplyForContractOut,
} from '../middleware/contractAccess.js'

const router = Router()

const ownerOfCI = ownerOfContractIn('contractInId')
const targetsManager = requireTargetsManager('contractInId')

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
// Ghi: chủ HĐ nhập/admin, HOẶC PM của chính HĐ bán đang ghép (tự ghép hàng cho dự án mình).
router.get('/contract-ins/:contractInId/supply-targets',                getSupplyTargets)
router.put('/purchase-boq/:id/supply-links',                            canLinkSupplyForContractOut(), setLinksForInBoqRow)

// Tập HĐ bán mà HĐ nhập "nhập cho" (contract_in_target). Đọc: mọi user.
// Ghi: người tạo HĐ nhập, PM của HĐ bán gốc, hoặc admin (requireTargetsManager) — họ gắn được
// tới HĐ bán BẤT KỲ, nên danh sách gợi ý là endpoint riêng (không dùng /contracts theo thành viên).
router.get('/contract-ins/:contractInId/targets',                       getTargets)
router.get('/contract-ins/:contractInId/target-candidates',             targetsManager, getTargetCandidates)
router.post('/contract-ins/:contractInId/targets',                      targetsManager, addTarget)
router.delete('/contract-ins/:contractInId/targets/:contractOutId',     targetsManager, removeTarget)

export default router
