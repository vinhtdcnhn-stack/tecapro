import { Router } from 'express'
import { getPMDashboard, getAssignedTasks, upsertTracking } from '../controllers/pmDashboardController.js'
import { requireSelfOrAdmin } from '../middleware/auth.js'

const router = Router()

// Dashboard/ghim-nhắc là dữ liệu cá nhân theo user — chỉ chính chủ (hoặc admin) được xem/ghi.
router.get('/pm/:userId/dashboard', requireSelfOrAdmin('userId'), getPMDashboard)
router.get('/pm/:userId/assigned-tasks', requireSelfOrAdmin('userId'), getAssignedTasks)
router.put('/pm/:userId/tracking', requireSelfOrAdmin('userId'), upsertTracking)

export default router
