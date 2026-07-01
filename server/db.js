import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'

const { Pool, types } = pg

// Return DATE columns as plain "YYYY-MM-DD" strings, not Date objects
// (prevents UTC-to-local conversion shifting the date by ±1 day)
types.setTypeParser(1082, val => val)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                        // số connection tối đa (mặc định pg là 10)
  idleTimeoutMillis: 30000,       // đóng connection rảnh sau 30s
  connectionTimeoutMillis: 5000,  // chờ tối đa 5s khi pool đã cạn rồi mới báo lỗi
})

// Lỗi trên client ĐANG RẢNH trong pool (vd DB rớt kết nối khi máy ngủ/DB restart)
// được phát ở pool. Bắt buộc có listener, nếu không Node sẽ ném lỗi làm sập tiến
// trình API. Chỉ cần log: pg tự loại client hỏng và tạo client mới ở request sau.
pool.on('error', (err) => {
  console.error('[db] Idle client error (pool sẽ tự hồi phục):', err.message)
})

// ─────────────────────────────────────────────────────────────────────────────
// Gắn NGƯỜI THAO TÁC cho nhật ký thay đổi (trigger trg_changelog đọc biến phiên
// `app.audit_actor`). AsyncLocalStorage mang actorId theo từng request (middleware
// auditActor.js set sau requireAuth). Ta bọc pool.query / pool.connect để set GUC
// (mức session) trên client TRƯỚC khi chạy câu lệnh GHI, rồi reset khi xong/release
// → trigger trong cùng connection thấy actor, KHÔNG rò rỉ sang request khác. Câu lệnh
// đọc (SELECT) hoặc khi không có actor đi thẳng pool gốc — không thêm chi phí.
// Controllers KHÔNG cần đổi gì: vẫn dùng pool.query / pool.connect như cũ.
// ─────────────────────────────────────────────────────────────────────────────
export const auditActorStore = new AsyncLocalStorage()

export function runWithActor(actorId, fn) {
  return auditActorStore.run({ actorId }, fn)
}

function currentActorId() {
  const id = auditActorStore.getStore()?.actorId
  return id == null ? null : String(id)
}

const SET_ACTOR = "SELECT set_config('app.audit_actor', $1, false)"
const RESET_ACTOR = "SELECT set_config('app.audit_actor', '', false)"

// Câu lệnh chỉ-đọc (không cần gắn actor). CTE ghi dữ liệu (`WITH ... INSERT/UPDATE/
// DELETE`) KHÔNG tính là đọc — phải gắn actor.
function isReadOnly(text) {
  const s = String(text || '').trimStart().toLowerCase()
  if (s.startsWith('show') || s.startsWith('explain') || s.startsWith('select')) return true
  if (s.startsWith('with')) return !/\b(insert|update|delete)\b/.test(s)
  return false
}

const rawQuery = pool.query.bind(pool)
const rawConnect = pool.connect.bind(pool)

// query(): chỉ bọc khi có actor VÀ là câu lệnh ghi. Hỗ trợ cả 2 dạng gọi của pg:
// query(text, params) và query({ text, values }).
pool.query = function auditedQuery(config, values) {
  const actor = currentActorId()
  const text = typeof config === 'string' ? config : config?.text
  if (!actor || isReadOnly(text)) {
    return rawQuery(config, values)
  }
  return (async () => {
    const client = await rawConnect()
    try {
      await client.query(SET_ACTOR, [actor])
      return await client.query(config, values)
    } finally {
      try { await client.query(RESET_ACTOR) } catch { /* connection có thể đã hỏng */ }
      client.release()
    }
  })()
}

// connect(): các controller tự BEGIN/transaction. Set GUC ngay sau khi mượn client,
// reset trước khi trả về pool (ghi đè release).
pool.connect = async function auditedConnect(...args) {
  // Dạng callback (ít dùng trong codebase) → để pg xử lý nguyên bản.
  if (typeof args[0] === 'function') return rawConnect(...args)

  const client = await rawConnect()
  const actor = currentActorId()
  if (!actor) return client

  try {
    await client.query(SET_ACTOR, [actor])
  } catch {
    return client // không chặn được thì thôi, vẫn trả client dùng bình thường
  }
  const origRelease = client.release.bind(client)
  let released = false
  client.release = (...rArgs) => {
    if (released) return origRelease(...rArgs)
    released = true
    // Reset GUC trước khi trả connection về pool (tránh rò rỉ actor).
    Promise.resolve(client.query(RESET_ACTOR)).catch(() => {}).finally(() => origRelease(...rArgs))
  }
  return client
}
