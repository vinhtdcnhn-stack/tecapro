import { pool } from '../db.js'

// ──────────────────────────────────────────────────────────────────────────────
// Đỉnh kết nối tới PostgreSQL trong tuần (rolling 7 ngày).
//
// Dashboard sức khỏe chỉ chạy query KHI có người mở tab, nên không thể dùng nó để
// bắt đỉnh. Thay vào đó, bộ này lấy mẫu NỀN mỗi phút (độc lập với tab), gom đỉnh
// theo TỪNG NGÀY (giờ VN) và giữ 7 ngày gần nhất. Đỉnh tuần = max của các ngày đó.
//
// Giữ trong bộ nhớ tiến trình (bounded: tối đa 7 bản ghi ngày) — KHÔNG bảng DB.
// Hệ quả: mốc này RESET khi khởi động lại tiến trình (deploy). Đủ cho mục đích
// "cảnh báo sớm sắp chạm trần"; muốn lịch sử bền vững thì dùng công cụ giám sát.
// ──────────────────────────────────────────────────────────────────────────────

const SAMPLE_MS = 60 * 1000
const WINDOW_DAYS = 7

// dateStr(YYYY-MM-DD, giờ VN) → { peak, peakAt(ISO), max }
const byDay = new Map()

function vnDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Bỏ các bản ghi ngày cũ hơn cửa sổ 7 ngày (so theo chuỗi YYYY-MM-DD).
function prune(today) {
  const [y, m, d] = today.split('-').map(Number)
  const cutoff = new Date(y, m - 1, d)
  cutoff.setDate(cutoff.getDate() - (WINDOW_DAYS - 1))
  const cutoffStr = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(cutoff)
  for (const key of byDay.keys()) if (key < cutoffStr) byDay.delete(key)
}

async function sample() {
  try {
    const { rows } = await pool.query(`
      SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS total,
             current_setting('max_connections')::int AS max`)
    const total = Number(rows[0].total)
    const max = Number(rows[0].max)
    const today = vnDate()
    prune(today)
    const cur = byDay.get(today)
    if (!cur || total > cur.peak) {
      byDay.set(today, { peak: total, peakAt: new Date().toISOString(), max })
    }
  } catch {
    // Lỗi tạm thời (DB bận/khởi động) — bỏ qua mẫu này, thử lại kỳ sau.
  }
}

// Đỉnh kết nối trong 7 ngày gần nhất: { peak, peakAt, max, pct } hoặc null nếu chưa có mẫu.
export function getWeeklyConnPeak() {
  prune(vnDate())
  let best = null
  for (const v of byDay.values()) {
    if (!best || v.peak > best.peak) best = v
  }
  if (!best) return null
  const pct = best.max ? Math.round((best.peak / best.max) * 1000) / 10 : null
  return { peak: best.peak, peakAt: best.peakAt, max: best.max, pct }
}

export function startDbConnPeakSampler() {
  sample()
  const t = setInterval(sample, SAMPLE_MS)
  t.unref()
  console.log('[db-conn-peak] đã bật — lấy mẫu đỉnh kết nối mỗi phút, giữ 7 ngày')
}
