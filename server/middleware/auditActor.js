import { auditActorStore } from '../db.js'

// Gắn id người dùng hiện tại vào AsyncLocalStorage cho cả vòng đời request, để các câu
// lệnh GHI (pool.query/pool.connect bọc trong db.js) set biến phiên `app.audit_actor`
// → trigger trg_changelog ghi đúng người thao tác vào change_log.
// CHẠY NGAY SAU requireAuth (cần req.user.id).
export function withAuditActor(req, res, next) {
  const actorId = req.user?.id
  if (actorId == null) return next()
  auditActorStore.run({ actorId }, next)
}
