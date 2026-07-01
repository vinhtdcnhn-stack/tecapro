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
  setBOQLock,
} from '../controllers/boqController.js'
import { downloadBOQTemplate, excelUpload } from '../controllers/boqExcel.js'
import {
  contractPermFromParam, contractPermVia, contractPermViaBody,
  blockIfLockedVia, blockIfLockedViaBody,
} from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.boq.manage' // quyền ghi tab Bảng giá (RBAC lớp B; bootstrap = PM)
const L = 'co.boq.lock'   // quyền khóa/mở khóa bảng giá (bootstrap = Trưởng/Phó ban)
// Khóa bảng giá: khi contract_out.boq_locked=true, chặn mọi thao tác ghi (kể cả admin/PM)
// tới khi mở. Đặt guard SAU guard quyền, TRƯỚC controller. Route mở/khóa KHÔNG gắn.
const lockByContract = blockIfLockedVia('boqContract', 'contractId', 'Bảng giá')

// Template download (no contractId needed)
router.get('/boq/template', downloadBOQTemplate)

// Collection routes — ghi yêu cầu quyền co.boq.manage trong HĐ (bị chặn khi bảng giá đã khóa)
router.get('/contracts/:contractId/boq',                        getBOQ)
router.post('/contracts/:contractId/boq',         contractPermFromParam(M), lockByContract, createBOQItem)
router.post('/contracts/:contractId/boq/after/:refId', contractPermFromParam(M), lockByContract, insertBOQAfter)
router.post('/contracts/:contractId/boq/reorder', contractPermFromParam(M), lockByContract, reorderBOQ)
router.post('/contracts/:contractId/boq/import',  contractPermFromParam(M), lockByContract, excelUpload.single('file'), importBOQPreview)
router.post('/contracts/:contractId/boq/save-import', contractPermFromParam(M), lockByContract, saveImportedBOQ)
// Khóa/mở khóa toàn bộ bảng giá — cần co.boq.lock (TP/PP + admin). KHÔNG gắn blockIfLocked.
router.patch('/contracts/:contractId/boq-lock',   contractPermFromParam(L), setBOQLock)

// Item routes
router.post('/boq/bulk-delete', contractPermViaBody(M, 'boq'), blockIfLockedViaBody('boqItem', 'Bảng giá'), bulkDeleteBOQItems)
router.put('/boq/:id',    contractPermVia(M, 'boq'), blockIfLockedVia('boqItem', 'id', 'Bảng giá'), updateBOQItem)
router.delete('/boq/:id', contractPermVia(M, 'boq'), blockIfLockedVia('boqItem', 'id', 'Bảng giá'), deleteBOQItem)

export default router
