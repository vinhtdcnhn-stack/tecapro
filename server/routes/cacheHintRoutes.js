import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { getCacheHints, postResetCacheHints, getSlowQueries, postFlushCache } from '../controllers/cacheHintController.js'
import { getSystemHealth } from '../controllers/systemHealthController.js'

const router = Router()

// Chẩn đoán hiệu năng / gợi ý cache — CHỈ ADMIN (cứng). Quyền system.cache_hint.view
// (adminOnly) chỉ để hiển thị mục menu; API vẫn chốt bằng requireAdmin.
router.use('/admin/cache-hints', requireAdmin)
router.use('/admin/cache', requireAdmin)
router.use('/admin/slow-queries', requireAdmin)
router.use('/admin/system-health', requireAdmin)

router.get('/admin/cache-hints', getCacheHints)
router.post('/admin/cache-hints/reset', postResetCacheHints)
router.post('/admin/cache/flush', postFlushCache)
router.get('/admin/slow-queries', getSlowQueries)
router.get('/admin/system-health', getSystemHealth)

export default router
