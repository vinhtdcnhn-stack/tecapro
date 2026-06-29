import { Router } from 'express'
import { getPMDashboard, getAssignedTasks, upsertTracking } from '../controllers/pmDashboardController.js'
import { getDeptWorkDashboard } from '../controllers/deptDashboardController.js'
import { getUnreadInbox } from '../controllers/unreadInboxController.js'
import { requireSelfOrAdmin } from '../middleware/auth.js'

const router = Router()

// Dashboard/ghim-nhắc là dữ liệu cá nhân theo user — chỉ chính chủ (hoặc admin) được xem/ghi.
router.get('/pm/:userId/dashboard', requireSelfOrAdmin('userId'), getPMDashboard)
router.get('/pm/:userId/assigned-tasks', requireSelfOrAdmin('userId'), getAssignedTasks)
router.put('/pm/:userId/tracking', requireSelfOrAdmin('userId'), upsertTracking)

// Hộp thư "Chưa đọc" — gom mọi việc có nội dung dòng thời gian chưa đọc với người xem.
router.get('/pm/:userId/unread-inbox', requireSelfOrAdmin('userId'), getUnreadInbox)

// Dashboard việc cả phòng (cho trưởng/phó phòng). requireSelfOrAdmin chặn người khác
// xem hộ; controller còn kiểm tra chức danh Trưởng/Phó ban trước khi trả dữ liệu phòng.
router.get('/dept/:userId/work-dashboard', requireSelfOrAdmin('userId'), getDeptWorkDashboard)

export default router
