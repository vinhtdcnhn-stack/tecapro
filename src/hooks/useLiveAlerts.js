import { useEffect, useState } from 'react'
import { API } from '../config/api'

// Long-poll HỢP NHẤT cho mọi cảnh báo/badge — thay 3 vòng poll cũ (contract-task 30s,
// dept-work 30s, inbox đề xuất 60s) bằng MỘT kết nối duy nhất. Server (GET /api/live/poll)
// giữ request tới khi số liệu của chính người dùng thực sự đổi, hoặc hết ~45s thì trả về;
// client nối lại ngay → ít request thừa hơn nhiều mà cập nhật gần như tức thời.
//
// Trả về { ct, dw, inbox } và tự bật/tắt class nền đỏ cảnh báo trên <body>:
//   • task-page-alert khi có mục công việc HĐ chưa đọc (mọi user)
//   • dw-page-alert  khi có báo cáo/chỉ đạo việc phòng chưa đọc (chỉ admin / Ban KT Cơ điện)
//
// Các nơi sau khi GHI vẫn phát event để ép poll lại NGAY (không chờ server đẩy):
// 'contracttask:refresh-unread', 'deptwork:refresh-unread', 'approval:refresh-inbox', focus.
const ZERO = { ct: 0, dw: 0, inbox: 0 }

export default function useLiveAlerts(user) {
  const [counts, setCounts] = useState(ZERO)
  const active = !!user
  // Nền đỏ việc phòng chỉ áp cho admin hoặc thành viên Ban KT Cơ điện (department 7).
  const dwAlertActive = !!user && (Number(user.role) === 1 || Number(user.department_id) === 7)

  useEffect(() => {
    if (!active) return
    let alive = true
    let controller = null
    let retryTimer = null

    // `known` = số liệu client đang giữ; truyền qua mỗi lần nối lại để server biết có gì đổi.
    const poll = async (known) => {
      if (!alive) return
      controller = new AbortController()
      // Phòng kết nối "treo" do mạng/proxy: tự hủy sau 55s (server trả trong ~45s) rồi nối lại.
      const safety = setTimeout(() => controller.abort(), 55000)
      try {
        const r = await fetch(
          `${API}/live/poll?ct=${known.ct}&dw=${known.dw}&inbox=${known.inbox}`,
          { signal: controller.signal },
        )
        clearTimeout(safety)
        if (!alive) return
        if (!r.ok) { retryTimer = setTimeout(() => poll(known), 5000); return }
        const d = await r.json()
        if (!alive) return
        const next = { ct: Number(d.ct) || 0, dw: Number(d.dw) || 0, inbox: Number(d.inbox) || 0 }
        setCounts(next)
        poll(next) // nối lại ngay với baseline mới → long-poll liên tục
      } catch {
        clearTimeout(safety)
        if (!alive) return
        // Bị abort (ép làm mới / safety) → nối lại ngay; lỗi mạng → lùi 3s rồi thử lại.
        if (controller?.signal.aborted) poll(known)
        else retryTimer = setTimeout(() => poll(known), 3000)
      }
    }

    // Ép poll lại tức thì: hủy request đang treo → vòng lặp tự nối lại với baseline hiện tại.
    const forceRefresh = () => { if (controller) controller.abort() }

    poll(ZERO)
    window.addEventListener('focus', forceRefresh)
    window.addEventListener('contracttask:refresh-unread', forceRefresh)
    window.addEventListener('deptwork:refresh-unread', forceRefresh)
    window.addEventListener('approval:refresh-inbox', forceRefresh)
    return () => {
      alive = false
      if (controller) controller.abort()
      clearTimeout(retryTimer)
      window.removeEventListener('focus', forceRefresh)
      window.removeEventListener('contracttask:refresh-unread', forceRefresh)
      window.removeEventListener('deptwork:refresh-unread', forceRefresh)
      window.removeEventListener('approval:refresh-inbox', forceRefresh)
    }
  }, [active])

  // Khi đăng xuất: xóa badge/nền đỏ ngay (effect long-poll đã dừng, không tự về 0).
  const view = active ? counts : ZERO

  // Bật/tắt nền đỏ cảnh báo toàn trang.
  useEffect(() => {
    document.body.classList.toggle('task-page-alert', active && view.ct > 0)
    return () => document.body.classList.remove('task-page-alert')
  }, [active, view.ct])

  useEffect(() => {
    document.body.classList.toggle('dw-page-alert', dwAlertActive && view.dw > 0)
    return () => document.body.classList.remove('dw-page-alert')
  }, [dwAlertActive, view.dw])

  return view
}
