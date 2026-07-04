import { monitorEventLoopDelay } from 'node:perf_hooks'

// ──────────────────────────────────────────────────────────────────────────────
// Đo độ trễ vòng lặp sự kiện (event loop lag) — chỉ số sức khỏe số 1 của Node.
// monitorEventLoopDelay chạy trong C++ (gần như không tốn gì), tích lũy histogram
// từ lúc enable. Mỗi lần đọc ta lấy mean/p99/max rồi RESET để lần sau phản ánh
// đúng cửa sổ kể từ lần đọc trước (dashboard tự làm mới ~6s).
// ──────────────────────────────────────────────────────────────────────────────

const histogram = monitorEventLoopDelay({ resolution: 10 })
histogram.enable()

// ns → ms (2 chữ số thập phân); trả null nếu chưa có mẫu hợp lệ.
const toMs = (ns) => (ns == null || !Number.isFinite(ns) || ns <= 0 ? 0 : Math.round(ns / 1e4) / 100)

// { mean, p99, max } tính bằng ms cho cửa sổ kể từ lần đọc trước.
export function readEventLoopDelay() {
  const res = { mean: toMs(histogram.mean), p99: toMs(histogram.percentile(99)), max: toMs(histogram.max) }
  histogram.reset()
  return res
}
