import { createClient } from 'redis'
import { logger } from './utils/logger.js'
import { markCacheUsed } from './middleware/cacheHint.js'

// Lớp cache Redis cho API đọc. NGUYÊN TẮC CỐT LÕI: Redis là phụ trợ, KHÔNG phải phụ thuộc
// cứng. Nếu Redis chưa cấu hình / mất kết nối / lỗi, mọi helper ở đây degrade êm về no-op
// (get→null, set/del→bỏ qua) để request vẫn chạy bằng cách query thẳng DB như cũ. Không
// endpoint nào được phép 500 vì Redis.
//
// Bật cache bằng env REDIS_URL (vd redis://localhost:6379). Bỏ trống = tắt cache.
// Bật CACHE_DEBUG=1 để log hit/miss khi kiểm chứng từng giai đoạn.

const DEBUG = !!process.env.CACHE_DEBUG

let client = null      // redis client (null = cache tắt)
let warned = false     // chỉ cảnh báo "redis down" một lần để khỏi spam log

// Khởi tạo + kết nối Redis. Gọi 1 lần khi server start (trong app.listen của index.js).
// An toàn để gọi kể cả khi không có REDIS_URL: chỉ log rồi return.
export async function connectCache() {
  const url = process.env.REDIS_URL
  if (!url) {
    logger.info('[cache] REDIS_URL chưa cấu hình — cache TẮT (chạy query thẳng DB).')
    return
  }
  client = createClient({ url })
  // Bắt buộc có listener 'error': nếu không, lỗi kết nối nền (Redis restart/ngủ) sẽ ném ra
  // và làm sập tiến trình. Chỉ log một lần; client tự thử kết nối lại ở nền.
  client.on('error', (err) => {
    if (!warned) {
      logger.warn('[cache] Redis lỗi/mất kết nối (cache tạm tắt, query thẳng DB):', err.message)
      warned = true
    }
  })
  client.on('ready', () => {
    warned = false
    logger.info('[cache] Redis đã kết nối — cache BẬT.')
  })
  try {
    await client.connect()
  } catch (err) {
    logger.warn('[cache] Không kết nối được Redis lúc khởi động (sẽ tự thử lại nền):', err.message)
  }
}

// Cache có sẵn sàng phục vụ không (đã connect và chưa rớt).
function ready() {
  return !!client && client.isReady
}

// Bản export công khai của ready(): các lớp khác (vd ETag/304) cần biết cache có thật sự
// sẵn sàng không để QUYẾT ĐỊNH có dùng version làm validator hay không. Khi cache TẮT,
// version luôn = 0 cố định → KHÔNG được phép trả 304 (sẽ phục vụ dữ liệu cũ).
export function isCacheReady() {
  return ready()
}

// Lấy giá trị JSON theo key. Trả null khi miss / cache tắt / lỗi.
export async function cacheGet(key) {
  if (!ready()) return null
  try {
    const raw = await client.get(key)
    if (raw == null) {
      if (DEBUG) logger.debug('[cache] MISS', key)
      return null
    }
    if (DEBUG) logger.debug('[cache] HIT', key)
    return JSON.parse(raw)
  } catch (err) {
    if (DEBUG) logger.debug('[cache] GET lỗi', key, err.message)
    return null
  }
}

// Đặt giá trị JSON theo key với TTL (giây). No-op khi cache tắt / lỗi.
export async function cacheSet(key, value, ttlSec) {
  if (!ready()) return
  try {
    const raw = JSON.stringify(value)
    if (ttlSec > 0) await client.set(key, raw, { EX: ttlSec })
    else await client.set(key, raw)
  } catch (err) {
    if (DEBUG) logger.debug('[cache] SET lỗi', key, err.message)
  }
}

// Xóa một hoặc nhiều key. No-op khi cache tắt / lỗi.
export async function cacheDel(...keys) {
  if (!ready() || keys.length === 0) return
  try {
    await client.del(keys.flat().filter(Boolean))
  } catch (err) {
    if (DEBUG) logger.debug('[cache] DEL lỗi', err.message)
  }
}

// Xóa TOÀN BỘ cache của DB Redis hiện tại (FLUSHDB). Dùng cho nút "Xóa cache" ở trang
// Chẩn đoán hiệu năng khi cần buộc mọi API đọc lại từ DB. Trả số key đã xóa (ước lượng
// bằng DBSIZE trước khi flush). Ném lỗi khi cache tắt để controller báo rõ cho admin.
// Đồng thời CONFIG RESETSTAT để đưa bộ đếm hit/miss (keyspace_hits/misses) về 0 — vì sau
// khi làm sạch cache, tỷ lệ hit cũ không còn ý nghĩa, đo lại từ đầu cho khớp. RESETSTAT
// cần quyền admin trên Redis; nếu bị chặn (ACL) thì chỉ bỏ qua bước reset, flush vẫn tính.
export async function flushCache() {
  if (!ready()) throw new Error('Cache đang tắt (chưa cấu hình/mất kết nối Redis).')
  const cleared = await client.dbSize()
  await client.flushDb()
  try {
    await client.sendCommand(['CONFIG', 'RESETSTAT'])
  } catch (err) {
    if (DEBUG) logger.debug('[cache] CONFIG RESETSTAT bị chặn (bỏ qua):', err.message)
  }
  return cleared
}

// Thống kê Redis cho trang giám sát hệ thống (chỉ đọc). Trả { ready:false } khi cache tắt/
// lỗi — KHÔNG ném để endpoint giám sát không vỡ. Parse INFO memory + DBSIZE.
export async function getCacheStats() {
  if (!ready()) return { ready: false }
  try {
    // Lấy cả 'memory' (dung lượng) và 'stats' (hit/miss) trong một lần INFO.
    const info = await client.info('memory')
    const stats = await client.info('stats')
    const pick = (src, k) => {
      const m = src.match(new RegExp(`^${k}:(.+)$`, 'm'))
      return m ? m[1].trim() : null
    }
    const usedBytes = Number(pick(info, 'used_memory')) || null
    const maxBytes = Number(pick(info, 'maxmemory')) || 0 // 0 = không giới hạn
    const keys = await client.dbSize()
    // keyspace_hits/misses là bộ đếm tích lũy từ lúc Redis khởi động (hoặc CONFIG RESETSTAT).
    const hits = Number(pick(stats, 'keyspace_hits')) || 0
    const misses = Number(pick(stats, 'keyspace_misses')) || 0
    const lookups = hits + misses
    return {
      ready: true,
      usedBytes,
      usedHuman: pick(info, 'used_memory_human'),
      maxBytes: maxBytes || null,
      maxHuman: maxBytes ? pick(info, 'maxmemory_human') : null,
      keys,
      hits,
      misses,
      hitRatePct: lookups ? Math.round((hits / lookups) * 1000) / 10 : null,
    }
  } catch {
    return { ready: false }
  }
}

// Helper chính: trả cache nếu hit; nếu miss thì chạy loaderFn(), lưu kết quả rồi trả.
// Lỗi Redis chỉ làm mất cache (vẫn chạy loaderFn) — KHÔNG bao giờ chặn loader.
export async function cacheWrap(key, ttlSec, loaderFn) {
  markCacheUsed() // đánh dấu route hiện tại có dùng lớp cache (cho trang Chẩn đoán hiệu năng)
  const cached = await cacheGet(key)
  if (cached !== null) return cached
  const fresh = await loaderFn()
  // Không cache giá trị null/undefined (coi như "không có dữ liệu", để lần sau vẫn thử lại).
  if (fresh !== null && fresh !== undefined) await cacheSet(key, fresh, ttlSec)
  return fresh
}

// --- Version-namespace: vô hiệu cả một nhóm key bằng cách tăng bộ đếm phiên bản ---
// Dùng cho báo cáo có nhiều biến thể tham số (from/to/asOf): thay vì SCAN xóa từng key,
// ta nhúng version vào key (vd report:debt:v3:...). Khi dữ liệu đổi, INCR version → mọi
// key version cũ trở thành "mồ côi" và tự hết hạn theo TTL.

// Lấy version hiện tại của namespace. Mặc định 0 khi CHƯA có key version (quan trọng:
// bumpVersion dùng INCR, từ rỗng → 1; nếu default ở đây là 1 thì lần bump ĐẦU TIÊN trên
// cache lạnh không đổi version và bỏ sót entry đã cache ở v1. Để default = 0 thì sau bump
// đầu tiên version chắc chắn khác (0 → 1)).
export async function cacheVersion(ns) {
  if (!ready()) return 0
  try {
    const v = await client.get(`ver:${ns}`)
    return v ? Number(v) : 0
  } catch {
    return 0
  }
}

// Tăng version của namespace (vô hiệu cả nhóm). No-op khi cache tắt.
export async function bumpVersion(ns) {
  if (!ready()) return
  try {
    await client.incr(`ver:${ns}`)
  } catch (err) {
    if (DEBUG) logger.debug('[cache] bumpVersion lỗi', ns, err.message)
  }
}
