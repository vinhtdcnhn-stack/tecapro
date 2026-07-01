import { Router } from 'express'
import {
  getBBTypes, createBBType, updateBBType, deleteBBType,
  getProgress, createProgress, updateProgress, deleteProgress,
  getProgressIn, createProgressIn, updateProgressIn, deleteProgressIn,
} from '../controllers/progressController.js'
import { contractPermFromParam, contractPermVia, ownerOfContractIn, ownerVia } from '../middleware/contractAccess.js'
import { requirePermission } from '../auth/permissions.js'

const router = Router()

// BB Type master — dữ liệu dùng chung mọi HĐ: ghi cần system.bbtypes.manage
router.get('/bb-types',       getBBTypes)
router.post('/bb-types',      requirePermission('system.bbtypes.manage'), createBBType)
router.put('/bb-types/:id',   requirePermission('system.bbtypes.manage'), updateBBType)
router.delete('/bb-types/:id', requirePermission('system.bbtypes.manage'), deleteBBType)

// Progress per contract — ghi cần co.progress.manage (bootstrap = PM)
router.get('/contracts/:contractId/progress',     getProgress)
router.post('/contracts/:contractId/progress',    contractPermFromParam('co.progress.manage'), createProgress)
router.put('/progress/:id',                       contractPermVia('co.progress.manage', 'progress'), updateProgress)
router.delete('/progress/:id',                    contractPermVia('co.progress.manage', 'progress'), deleteProgress)

// Progress per contract_in — ghi yêu cầu là người tạo HĐ nhập (hoặc admin)
router.get('/contract-ins/:contractInId/progress',    getProgressIn)
router.post('/contract-ins/:contractInId/progress',   ownerOfContractIn('contractInId'), createProgressIn)
router.put('/progress-in/:id',                        ownerVia('progressIn'), updateProgressIn)
router.delete('/progress-in/:id',                     ownerVia('progressIn'), deleteProgressIn)

export default router
