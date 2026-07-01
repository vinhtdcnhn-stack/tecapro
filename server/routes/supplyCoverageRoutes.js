import { Router } from 'express'
import {
  getSupplyCoverage,
  getCoverageSummary,
  setNoImportNeeded,
  createSlot,
  updateSlot,
  deleteSlot,
  reorderSlots,
} from '../controllers/supplyCoverageController.js'
import { contractPermFromParam, contractPermVia } from '../middleware/contractAccess.js'

const router = Router()

const M = 'co.supply.manage' // ghi đầu nhập / cờ nhập = quyền tab Theo dõi nhập hàng (bootstrap = PM)

// Đọc (mọi user đã đăng nhập)
router.get('/contracts/:contractId/supply-coverage',         getSupplyCoverage)
router.get('/contracts/:contractId/supply-coverage/summary', getCoverageSummary)

// Cờ "không cần nhập" trên dòng bảng giá bán (PM)
router.put('/boq/:id/no-import-needed', contractPermVia(M, 'boq'), setNoImportNeeded)

// Đầu nhập CRUD (PM)
router.post('/contracts/:contractId/supply-slots',         contractPermFromParam(M), createSlot)
router.post('/contracts/:contractId/supply-slots/reorder', contractPermFromParam(M), reorderSlots)
router.put('/supply-slots/:id',    contractPermVia(M, 'supplySlot'), updateSlot)
router.delete('/supply-slots/:id', contractPermVia(M, 'supplySlot'), deleteSlot)

export default router
