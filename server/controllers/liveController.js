import { liveCountsFor } from '../services/liveCounts.js'
import { onLiveChange } from '../services/eventBus.js'
import { touch } from '../services/presence.js'

// Giữ kết nối tối đa ~45s rồi trả về (kể cả khi không đổi) để: (1) nằm an toàn trong
// proxy_read_timeout mặc định 60s của nginx, (2) cho client cơ hội tự reconnect/đổi
// phiên. Client sẽ nối lại ngay lập tức → tạo thành long-poll liên tục.
const HOLD_MS = 45000

const sameCounts = (a, b) =>
  a && b && a.ct === b.ct && a.dw === b.dw && a.tn === b.tn && a.inbox === b.inbox

// GET /api/live/poll?ct=&dw=&tn=&inbox=
// Long-poll: trả NGAY nếu số liệu hiện tại khác số liệu client đang giữ (truyền qua query).
// Nếu chưa đổi → treo cho tới khi có sự kiện bumpLive làm số liệu thay đổi, hoặc hết HOLD_MS.
export async function pollLive(req, res) {
  // Mỗi tab đang mở liên tục giữ long-poll này → dùng làm tín hiệu "đang online".
  touch(req.user.id)

  const known = {
    ct: Number(req.query.ct) || 0,
    dw: Number(req.query.dw) || 0,
    tn: Number(req.query.tn) || 0,
    inbox: Number(req.query.inbox) || 0,
  }

  let settled = false
  let unsubscribe = () => {}
  let timer = null

  const finish = async () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubscribe()
    try {
      const counts = await liveCountsFor(req.user)
      res.json({ changed: !sameCounts(counts, known), ...counts })
    } catch (err) {
      // Lỗi tính số liệu: trả về số client đang giữ + cờ lỗi, client sẽ thử lại sau.
      console.error('pollLive finish:', err)
      if (!res.headersSent) res.json({ changed: false, error: true, ...known })
    }
  }

  try {
    // 1) Kiểm tra ngay: nếu đã khác thì khỏi treo.
    const current = await liveCountsFor(req.user)
    if (!sameCounts(current, known)) {
      settled = true
      res.json({ changed: true, ...current })
      return
    }

    // 2) Treo: thức dậy khi có bumpLive (tính lại, chỉ trả khi thực sự khác) hoặc hết giờ.
    unsubscribe = onLiveChange(async () => {
      if (settled) return
      try {
        const counts = await liveCountsFor(req.user)
        if (!sameCounts(counts, known)) finish()
        // Sự kiện không liên quan tới user này → tiếp tục treo.
      } catch (err) {
        console.error('pollLive onChange:', err)
      }
    })

    timer = setTimeout(() => finish(), HOLD_MS)

    // Client đóng tab/hủy request giữa chừng → dọn dẹp, không trả nữa.
    req.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
    })
  } catch (err) {
    console.error('pollLive:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể theo dõi cập nhật.' })
  }
}
