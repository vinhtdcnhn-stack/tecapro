import { Router } from 'express'
import { pollLive } from '../controllers/liveController.js'

// Long-poll hợp nhất cho cảnh báo/badge (đã nằm sau requireAuth ở routes/index.js).
// Thay cho 3 vòng poll 30s/60s cũ: /contract-tasks/unread-count, /dept-work/unread-count,
// /approvals/requests/inbox.
const router = Router()

router.get('/live/poll', pollLive)

export default router
