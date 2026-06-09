import { Router } from 'express'
import { getPMDashboard, upsertTracking } from '../controllers/pmDashboardController.js'

const router = Router()

router.get('/pm/:userId/dashboard', getPMDashboard)
router.put('/pm/:userId/tracking', upsertTracking)

export default router
