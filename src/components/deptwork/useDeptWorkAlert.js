import { useEffect, useState } from 'react'
import { API } from '../../config/api'

const POLL_MS = 30000

// Đếm tổng số mục dòng thời gian CHƯA ĐỌC của người dùng (trên mọi việc liên quan)
// và bật class `dw-page-alert` lên <body> khi > 0 → đổi nền toàn trang sang đỏ cảnh báo.
// Chỉ chạy cho thành viên Ban KT Cơ điện (department 7) hoặc admin.
// Tự cập nhật khi: tải lần đầu · mỗi 30s · quay lại tab · nghe event 'deptwork:refresh-unread'
// (bảng việc phát ra sau khi tải lại để xóa cảnh báo ngay sau khi đọc).
export default function useDeptWorkAlert(user) {
  const [count, setCount] = useState(0)
  const active = !!user && (Number(user.role) === 1 || Number(user.department_id) === 7)

  useEffect(() => {
    if (!active) return
    let alive = true
    async function poll() {
      try {
        const r = await fetch(`${API}/dept-work/unread-count`)
        if (!r.ok) return
        const d = await r.json()
        if (alive) setCount(Number(d.count) || 0)
      } catch { /* bỏ qua lỗi mạng */ }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    window.addEventListener('focus', poll)
    window.addEventListener('deptwork:refresh-unread', poll)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('focus', poll)
      window.removeEventListener('deptwork:refresh-unread', poll)
    }
  }, [active])

  useEffect(() => {
    document.body.classList.toggle('dw-page-alert', active && count > 0)
    return () => document.body.classList.remove('dw-page-alert')
  }, [active, count])

  return count
}
