import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { listChanges, contractTimeline, getOptions, rowTimeline } from '../controllers/auditController.js'

const router = Router()

// Nhật ký thay đổi — CHỈ ADMIN (cứng). Quyền system.audit_log.view (adminOnly) chỉ dùng
// để hiển thị mục trong ma trận phân quyền / menu; API vẫn chốt bằng requireAdmin.
router.use('/audit', requireAdmin)

router.get('/audit/changes', listChanges)
router.get('/audit/options', getOptions)
router.get('/audit/contract/:contractId', contractTimeline)
router.get('/audit/row/:tableName/:rowId', rowTimeline)

export default router
