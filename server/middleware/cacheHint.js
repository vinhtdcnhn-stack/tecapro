// ──────────────────────────────────────────────────────────────────────────────
// Đo thời gian phản hồi per-route cho request GET, để lộ những endpoint đọc "nóng +
// chậm" đáng cân nhắc bọc cache (cacheWrap). CHỈ THU THẬP — không tác động luồng xử lý,
// không đổi dữ liệu. On-by-default: chi phí chỉ là một phép trừ mốc thời gian + cập nhật
// bộ đếm theo route, nhẹ hơn một query DB nhiều bậc.
//
// QUAN TRỌNG: gom theo ROUTE PATTERN (req.route.path, vd /contracts/:id/tasks) chứ KHÔNG
// theo URL thô (chứa id → mỗi id một khóa → map phình vô hạn). Nhờ vậy map luôn bị chặn ở
// đúng số route của app (vài chục dòng) — để chạy mãi cũng không tốn bộ nhớ.
// ──────────────────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks'

// Reservoir cố định để ước lượng p95 mà không giữ toàn bộ mẫu (bộ nhớ bó gọn per-route).
const MAX_SAMPLES = 200

// routeKey -> { count, sumMs, maxMs, samples:number[], lastAt, firstAt, cached }
const stats = new Map()
let windowStart = Date.now()

// Route real-time / long-poll: loại khỏi thống kê. /live/poll cố tình TREO ~45s (không phải
// "chậm"), badge & hộp thư chưa-đọc cố tình KHÔNG cache (dữ liệu phải tươi tức thì) — đưa vào
// bảng gợi ý chỉ gây nhiễu.
const EXCLUDE = [/\/live\/poll/, /\/unread-inbox/]

// Phát hiện "route có dùng cache" CHÍNH XÁC LÚC CHẠY thay vì đoán bằng danh sách route ghi
// tay (dễ lệch khi thêm/bớt cacheWrap). Store theo từng request: cacheWrap và versionNotModified
// gọi markCacheUsed() → biết request này đã đi qua lớp cache. Nhãn "cached" per-route là STICKY
// (một request bất kỳ dùng cache là đủ kết luận route có cache).
const cacheFlag = new AsyncLocalStorage()
export function markCacheUsed() {
  const store = cacheFlag.getStore()
  if (store) store.used = true
}

// Dựng khóa route ổn định từ pattern đã khớp (baseUrl của router lồng + route.path).
function routeKey(req) {
  const path = req.route?.path
  if (!path) return null // static/SPA/404 không có route pattern → bỏ qua
  const base = req.baseUrl || ''
  const full = `${base}${path === '/' ? '' : path}`.replace(/\/+$/, '')
  return full || null
}

// Middleware: đặt SỚM (trước khi định tuyến) để res.on('finish') bắt trọn thời gian. Tại
// thời điểm 'finish', req.route/baseUrl đã được điền bởi router khớp phía sau. Chạy phần còn
// lại của request trong ngữ cảnh AsyncLocalStorage để markCacheUsed() (gọi từ cacheWrap /
// versionNotModified sâu bên dưới) ghi được cờ vào đúng store của request này.
export function cacheHint(req, res, next) {
  if (req.method !== 'GET') return next()
  const start = process.hrtime.bigint()
  const store = { used: false }
  res.on('finish', () => {
    const key = routeKey(req)
    if (!key || EXCLUDE.some((re) => re.test(key))) return
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    let s = stats.get(key)
    if (!s) { s = { count: 0, sumMs: 0, maxMs: 0, samples: [], lastAt: 0, firstAt: Date.now(), cached: false }; stats.set(key, s) }
    s.count++
    s.sumMs += ms
    s.lastAt = Date.now()
    if (store.used) s.cached = true // sticky: route đã đi qua lớp cache ít nhất một lần
    if (ms > s.maxMs) s.maxMs = ms
    // Reservoir sampling: đầy thì thay ngẫu nhiên một chỗ (giữ phân phối, chặn bộ nhớ).
    if (s.samples.length < MAX_SAMPLES) s.samples.push(ms)
    else s.samples[Math.floor(Math.random() * MAX_SAMPLES)] = ms
  })
  cacheFlag.run(store, next)
}

// Phân vị từ mảng mẫu (không sửa mảng gốc). p ∈ [0,1].
function percentile(samples, p) {
  if (!samples.length) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]
}

// Ảnh chụp thống kê để controller trả về. Mỗi dòng kèm p95/trung bình/số gọi + nhãn cache +
// cờ "gợi ý" (nóng && chậm && chưa cache). Ngưỡng nhận từ tham số để chỉnh theo tải thật.
export function snapshotHints({ minP95 = 80, minCount = 50 } = {}) {
  const now = Date.now()
  const elapsedMin = Math.max(1 / 60, (now - windowStart) / 60000)
  const rows = []
  for (const [route, s] of stats) {
    const p95 = Math.round(percentile(s.samples, 0.95))
    const avg = Math.round(s.sumMs / s.count)
    const cached = s.cached
    rows.push({
      route,
      count: s.count,
      rpm: +(s.count / elapsedMin).toFixed(1),
      avgMs: avg,
      p95Ms: p95,
      maxMs: Math.round(s.maxMs),
      cached,
      lastAt: new Date(s.lastAt).toISOString(),
      // Gợi ý cache: đủ nóng + đủ chậm + chưa cache. Route đã cache vẫn liệt kê (để thấy cache
      // có giúp không) nhưng không gắn cờ gợi ý.
      suggest: !cached && s.count >= minCount && p95 >= minP95,
    })
  }
  // Gợi ý lên đầu, rồi theo "tổng gánh nặng" ≈ p95 × số gọi.
  rows.sort((a, b) => (b.suggest - a.suggest) || (b.p95Ms * b.count - a.p95Ms * a.count))
  return { since: new Date(windowStart).toISOString(), thresholds: { minP95, minCount }, rows }
}

// Xóa bộ đếm (nút "Đặt lại" — vd sau khi vừa thêm cache xong, đo lại từ đầu).
export function resetHints() {
  stats.clear()
  windowStart = Date.now()
}
