import { logger } from '../utils/logger.js'
import { isCacheReady, cacheGet, cacheSet, cacheVersion } from '../cache.js'

// ──────────────────────────────────────────────────────────────────────────────
// REFRESH-AHEAD: sau khi một key bị vô hiệu (cacheDel / bumpVersion), tự NẠP LẠI dữ liệu
// mới vào cache ở NỀN, lúc server rảnh — để người đọc kế tiếp không phải trả giá miss lạnh.
//
// Vì sao không phải sửa call-site: cacheWrap(key, ttl, loaderFn) đã cầm đủ 3 thứ cần
// (khóa, TTL, hàm nạp). Mỗi lần một key được ĐỌC, ta ghi nhớ loader của nó vào registry
// trong RAM; khi key đó bị vô hiệu, đẩy vào hàng đợi; worker nền gọi lại chính loader ấy.
//
// BA VAN AN TOÀN (thiếu một cái là refresh-ahead phản tác dụng, tăng tải DB):
//   ① CHỈ KEY NÓNG — registry chỉ chứa key đã có người đọc; entry HOT_TTL không ai đọc thì
//      bỏ. Không hâm nóng dữ liệu chẳng ai xem.
//   ② GỘP (debounce) — sửa liên tiếp 10 dòng BOQ chỉ nạp lại 1 lần, sau nhịp ghi cuối.
//   ③ CHỈ CHẠY KHI RẢNH — không có request nào đang xử lý mới nạp, mỗi nhịp tối đa vài key.
//      Chờ quá MAX_WAIT_MS mà server vẫn bận thì BỎ (người đọc tiếp theo tự chịu miss như cũ)
//      — hâm nóng là cơ hội, không phải nghĩa vụ.
//
// CHỐNG ĐUA (quan trọng nhất): loader chạy nền có thể đọc DB xong RỒI mới có người ghi và
// invalidate — nếu cứ set kết quả cũ vào cache thì ta tự tay "đầu độc" cache bằng dữ liệu
// cũ tới hết TTL, tệ hơn hẳn không hâm nóng. Chặn bằng bộ đếm thế hệ `gen`: mỗi lần key bị
// vô hiệu, gen++. Warm chụp gen trước khi chạy loader và so lại sau khi loader xong — khác
// nhau nghĩa là có ghi chen ngang → VỨT kết quả, không set. (Đúng trong 1 tiến trình Node —
// mọi invalidation của app đều đi qua cacheDel/bumpVersion ở tiến trình này.)
// ──────────────────────────────────────────────────────────────────────────────

const HOT_TTL_MS = 15 * 60 * 1000  // key không ai đọc quá 15' → bỏ khỏi registry (hết "nóng")
const DEBOUNCE_MS = 3000           // gộp các lượt ghi dồn dập vào 1 lần nạp
const MAX_WAIT_MS = 60 * 1000      // chờ rảnh quá lâu → bỏ, để người đọc tự nạp
const TICK_MS = 2000               // nhịp kiểm tra hàng đợi
const MAX_PER_TICK = 3             // trần số key nạp mỗi nhịp (chặn dội tải DB)
const MAX_ENTRIES = 500            // trần registry (mỗi entry giữ 1 closure loader → chặn RAM)

// id → { id, ns, rest, ttl, loader, lastRead, gen }
//   ns = null  → key cố định (vô hiệu bằng cacheDel), id CHÍNH LÀ key.
//   ns != null → key có version (vô hiệu bằng bumpVersion): key thật đổi sau mỗi lần bump nên
//                registry lưu phần BẤT BIẾN (ns + rest), key được dựng lại lúc warm.
const registry = new Map()

// id → thời điểm đến hạn nạp (debounce). Chỉ chứa key đang chờ hâm nóng.
const queue = new Map()

const stats = { warmed: 0, discarded: 0, skippedFresh: 0, dropped: 0, errors: 0, lastWarmAt: null }

// Số request API đang xử lý — tín hiệu "rảnh".
let inflight = 0

// Quy ước KEY CÓ VERSION: `<ns>:v<n>:<phần còn lại>` (xem cacheKeys.js). Tách để biết ns mà
// dựng lại key sau khi version đổi. Non-greedy → lấy cụm `:v<số>:` ĐẦU TIÊN.
const VERSIONED_RE = /^(.*?):v(\d+):(.*)$/

function parseKey(key) {
  const m = VERSIONED_RE.exec(key)
  if (!m) return { id: key, ns: null, rest: null }
  const [, ns, , rest] = m
  return { id: `${ns}:v*:${rest}`, ns, rest }  // id bất biến qua các lần bump version
}

// ─────────────────────────── Ghi nhận lượt đọc ───────────────────────────
// Gọi từ cacheWrap ở MỌI lượt đọc (hit lẫn miss): đây là nơi duy nhất ta thấy được cặp
// (key, loader). Chỉ ghi vào Map — không I/O.
export function noteRead(key, ttlSec, loader) {
  if (!isCacheReady()) return
  const { id, ns, rest } = parseKey(key)
  const cur = registry.get(id)
  if (cur) {
    cur.lastRead = Date.now()
    cur.loader = loader   // giữ closure MỚI NHẤT (bám tham số request gần nhất)
    cur.ttl = ttlSec
    return
  }
  if (registry.size >= MAX_ENTRIES) evictColdest()
  registry.set(id, { id, ns, rest, ttl: ttlSec, loader, lastRead: Date.now(), gen: 0 })
}

// Registry đầy → bỏ entry lâu không đọc nhất (LRU đơn giản, kích thước map nhỏ).
function evictColdest() {
  let oldest = null
  for (const e of registry.values()) if (!oldest || e.lastRead < oldest.lastRead) oldest = e
  if (oldest) { registry.delete(oldest.id); queue.delete(oldest.id) }
}

// ─────────────────────────── Ghi nhận lượt vô hiệu ───────────────────────────
// Gọi từ cacheDel: các key CỐ ĐỊNH vừa bị xóa.
export function noteInvalidateKeys(keys) {
  for (const key of keys) enqueue(registry.get(key))
}

// Gọi từ bumpVersion: cả một NHÓM key (vd 'report:debt', 'contract-list') vừa bị vô hiệu.
export function noteInvalidateNs(ns) {
  for (const e of registry.values()) if (e.ns === ns) enqueue(e)
}

// Đưa vào hàng đợi + tăng gen (chống đua). Ghi dồn dập → dueAt bị đẩy lùi mỗi lần = gộp.
function enqueue(entry) {
  if (!entry) return  // key chưa từng được đọc → không "nóng" → không hâm nóng (van ①)
  entry.gen++
  queue.set(entry.id, Date.now() + DEBOUNCE_MS)
}

// ─────────────────────────── Đếm request đang chạy ───────────────────────────
// Middleware đặt sớm trong chuỗi API: inflight > 0 nghĩa là server đang bận phục vụ người
// thật → worker nhường DB, không nạp nền.
//
// LOẠI TRỪ long-poll: /live/poll cố tình TREO ~45 giây (chờ sự kiện, không dùng DB). Nếu
// đếm nó thì với vài người đang mở app, inflight gần như KHÔNG BAO GIỜ về 0 và worker chẳng
// bao giờ chạy — request treo là "đang chờ", không phải "đang bận".
const NOT_BUSY = /\/live\/poll/

export function trackInflight(req, res, next) {
  if (NOT_BUSY.test(req.originalUrl)) return next()
  inflight++
  let done = false
  const end = () => { if (!done) { done = true; inflight-- } }
  res.on('finish', end)
  res.on('close', end)   // client ngắt giữa chừng: 'finish' không bắn → tránh rò bộ đếm
  next()
}

// ─────────────────────────── Worker nền ───────────────────────────
let running = false

async function tick() {
  if (running) return
  running = true
  try {
    if (!isCacheReady()) { queue.clear(); return }
    const now = Date.now()

    // Dọn entry hết "nóng" (van ①).
    for (const [id, e] of registry) {
      if (now - e.lastRead > HOT_TTL_MS) { registry.delete(id); queue.delete(id) }
    }

    // Bỏ mục chờ quá lâu (server bận liên tục) — hâm nóng chỉ là cơ hội (van ③).
    for (const [id, dueAt] of queue) {
      if (now - (dueAt - DEBOUNCE_MS) > MAX_WAIT_MS) { queue.delete(id); stats.dropped++ }
    }

    if (inflight > 0 || queue.size === 0) return  // đang bận → để nhịp sau

    const due = []
    for (const [id, dueAt] of queue) {
      if (dueAt <= now) due.push(id)
      if (due.length >= MAX_PER_TICK) break
    }
    for (const id of due) {
      queue.delete(id)
      const entry = registry.get(id)
      if (entry) await warmOne(entry)
      if (inflight > 0) break  // có người dùng vào giữa chừng → dừng ngay, nhường DB
    }
  } catch (err) {
    stats.errors++
    logger.warn('[warm] vòng lặp lỗi:', err.message)
  } finally {
    running = false
  }
}

// Nạp lại 1 key: dựng key hiện hành → bỏ qua nếu đã có ai nạp → chạy loader → kiểm tra đua
// → set. Mọi lỗi chỉ được LOG: hâm nóng thất bại thì cache vẫn trống như cũ, người đọc kế
// tiếp query thẳng DB (đúng hành vi trước khi có lớp này).
async function warmOne(entry) {
  const gen0 = entry.gen
  try {
    const ver0 = entry.ns ? await cacheVersion(entry.ns) : null
    const key = entry.ns ? `${entry.ns}:v${ver0}:${entry.rest}` : entry.id

    // Đã có người đọc và nạp lại trước ta (vd FE tự refetch ngay sau khi lưu) → khỏi query.
    if (await cacheGet(key) !== null) { stats.skippedFresh++; return }

    const data = await entry.loader()
    if (data === null || data === undefined) return

    // CHỐNG ĐUA: có ghi chen ngang trong lúc loader chạy → dữ liệu vừa đọc có thể đã cũ, VỨT.
    const verNow = entry.ns ? await cacheVersion(entry.ns) : null
    if (entry.gen !== gen0 || verNow !== ver0) { stats.discarded++; return }

    await cacheSet(key, data, entry.ttl)
    stats.warmed++
    stats.lastWarmAt = new Date().toISOString()
  } catch (err) {
    stats.errors++
    logger.warn('[warm] nạp lại thất bại', entry.id, '—', err.message)
  }
}

// Khởi động worker (gọi 1 lần lúc server start). unref() để không giữ tiến trình sống.
export function startCacheWarmer() {
  setInterval(tick, TICK_MS).unref()
  logger.info('[warm] Refresh-ahead đã bật (nạp lại cache ở nền khi server rảnh).')
}

// Số liệu cho trang Chẩn đoán hiệu năng (chỉ xem).
export function warmerStats() {
  return {
    ...stats,
    tracked: registry.size,   // số key "nóng" đang theo dõi loader
    queued: queue.size,       // số key đang chờ nạp lại
    inflight,
  }
}
