import { Router } from 'express'
import {
  getBBTypes, createBBType, updateBBType, deleteBBType,
  getProgress, createProgress, updateProgress, deleteProgress,
  getProgressIn, createProgressIn, updateProgressIn, deleteProgressIn,
} from '../controllers/progressController.js'
import { pmFromParam, pmVia } from '../middleware/contractAccess.js'

const router = Router()

// BB Type master — dữ liệu dùng chung mọi HĐ, không thuộc một dự án nên không gate theo PM
router.get('/bb-types',       getBBTypes)
router.post('/bb-types',      createBBType)
router.put('/bb-types/:id',   updateBBType)
router.delete('/bb-types/:id', deleteBBType)

// Progress per contract — ghi yêu cầu PM của HĐ (F-11)
router.get('/contracts/:contractId/progress',     getProgress)
router.post('/contracts/:contractId/progress',    pmFromParam(), createProgress)
router.put('/progress/:id',                       pmVia('progress'), updateProgress)
router.delete('/progress/:id',                    pmVia('progress'), deleteProgress)

// Progress per contract_in (reuses same bb-types)
router.get('/contract-ins/:contractInId/progress',    getProgressIn)
router.post('/contract-ins/:contractInId/progress',   pmVia('contractIn', 'contractInId'), createProgressIn)
router.put('/progress-in/:id',                        pmVia('progressIn'), updateProgressIn)
router.delete('/progress-in/:id',                     pmVia('progressIn'), deleteProgressIn)

export default router
