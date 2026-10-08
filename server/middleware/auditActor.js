import { auditActorStore } from '../db.js'

// Gắn id người dùng hiện tại vào AsyncLocalStorage cho cả vòng đời request, để các câu
// lệnh GHI (pool.query/pool.connect bọc trong db.js) set biến phiên `app.audit_actor`
// → trigger trg_changelog ghi đúng người thao tác vào change_log.
// CHẠY NGAY SAU requireAuth (cần req.user.id).
//
// Cùng store mang cờ enforceFreeze (request không phải GET) để trigger khóa HĐ đã Hoàn thành
// (migration 108) có hiệu lực. Khi trigger chặn, db.js ghi store.frozenError; ở đây ta chặn
// res.json: nếu đang trả lỗi (>= 400) thì đổi thành 423 + đúng thông báo "HĐ đã Hoàn thành"
// thay cho thông báo chung chung của controller (không phải sửa từng controller).
export function withAuditActor(req, res, next) {
  const actorId = req.user?.id
  if (actorId == null) return next()
  const store = { actorId, enforceFreeze: req.method !== 'GET' && req.method !== 'HEAD' }
  const origJson = res.json.bind(res)
  res.json = (body) => {
    if (store.frozenError && res.statusCode >= 400) {
      res.status(423)
      return origJson({ error: store.frozenError, frozen: true })
    }
    return origJson(body)
  }
  auditActorStore.run(store, next)
}
