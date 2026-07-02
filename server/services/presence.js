// Sổ hiện diện TRONG RAM: theo dõi người dùng "đang online" dựa trên các request
// long-poll /api/live/poll mà mỗi tab đang mở liên tục giữ (xem liveController.js).
// Mỗi lần một request long-poll tới, gọi touch(userId) → cập nhật mốc "thấy lần cuối".
// online() trả về danh sách userId còn thấy trong ONLINE_WINDOW_MS gần đây.
//
// Chỉ đúng khi chạy ĐƠN tiến trình Express (như hiện tại). Nếu sau này scale nhiều
// instance, thay Map này bằng Redis (SETEX theo userId) — giữ nguyên API touch/online.

// Người dùng được coi là online nếu long-poll của họ ghé qua trong khoảng này. Long-poll
// treo tối đa ~45s rồi client nối lại ngay, nên 90s đủ rộng để không "chớp tắt" giữa 2 lần.
const ONLINE_WINDOW_MS = 90_000

// Map<userId(number), lastSeenAt(ms)>
const seen = new Map()

// Đánh dấu một người dùng vừa hoạt động (gọi từ mỗi request long-poll).
export function touch(userId) {
  if (userId == null) return
  seen.set(Number(userId), Date.now())
}

// Dọn các mốc quá cũ để Map không phình theo thời gian.
function prune(now = Date.now()) {
  for (const [id, at] of seen) {
    if (now - at > ONLINE_WINDOW_MS) seen.delete(id)
  }
}

// Danh sách userId đang online (đã dọn key cũ).
export function onlineUserIds() {
  const now = Date.now()
  prune(now)
  return [...seen.keys()]
}
