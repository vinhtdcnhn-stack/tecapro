import { useEffect, useState } from 'react'
import { API } from '../../config/api'

const POLL_MS = 30000

// Đếm tổng số mục dòng thời gian CHƯA ĐỌC của người dùng trên mọi việc HĐ liên quan
// (người tạo / người được giao / PM của HĐ) và bật class `task-page-alert` lên <body>
// khi > 0 → đổi nền toàn trang sang đỏ cảnh báo. Chạy cho mọi user đã đăng nhập (server
// đã lọc theo quan hệ với việc → người không liên quan luôn nhận 0).
// Tự cập nhật khi: tải lần đầu · mỗi 30s · quay lại tab · nghe 'contracttask:refresh-unread'.
export default function useContractTaskAlert(user) {
  const [count, setCount] = useState(0)
  const active = !!user

  useEffect(() => {
    if (!active) return
    let alive = true
    async function poll() {
      try {
        const r = await fetch(`${API}/contract-tasks/unread-count`)
        if (!r.ok) return
        const d = await r.json()
        if (alive) setCount(Number(d.count) || 0)
      } catch { /* bỏ qua lỗi mạng */ }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    window.addEventListener('focus', poll)
    window.addEventListener('contracttask:refresh-unread', poll)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('focus', poll)
      window.removeEventListener('contracttask:refresh-unread', poll)
    }
  }, [active])

  useEffect(() => {
    document.body.classList.toggle('task-page-alert', active && count > 0)
    return () => document.body.classList.remove('task-page-alert')
  }, [active, count])

  return count
}
