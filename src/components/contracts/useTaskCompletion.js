import { useState } from 'react'
import { API } from '../../config/api'

// ─────────────────────────────────────────────────────────────────────────────
// Đổi trạng thái + XÁC NHẬN HOÀN THÀNH công việc hợp đồng.
//
// Người được giao tự chọn "Hoàn thành" → server gắn cờ chờ xác nhận
// (completion_pending). Người GIAO việc (hoặc PM/admin) bấm "Xác nhận" để chốt, hoặc
// "Chưa đạt" kèm LÝ DO → việc về "Đang thực hiện" và lý do được ghi vào dòng thời gian.
//
// onChanged(task): thay 1 việc trong danh sách; reload(): tải lại cả cây (trạng thái việc
// cha/việc phụ thuộc có thể đổi theo).
// ─────────────────────────────────────────────────────────────────────────────
export function useTaskCompletion({ onChanged, reload }) {
  // Việc đang mở hộp thoại "Chưa đạt" (nhập lý do); null = đang đóng.
  const [rejectTask, setRejectTask] = useState(null)

  async function call(url, options) {
    const res = await fetch(url, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Thao tác không thành công.')
    return data
  }

  async function changeStatus(task, newStatus) {
    try {
      const data = await call(`${API}/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onChanged(data)
      // Đổi trạng thái có thể: (a) mở khóa việc phụ thuộc; (b) tự hoàn thành/mở lại việc
      // cha theo cây con → tải lại để hiển thị trạng thái mới của toàn cây.
      reload()
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  async function confirmCompletion(task) {
    try {
      const data = await call(`${API}/tasks/${task.id}/completion/confirm`, { method: 'POST' })
      onChanged(data)
      reload()
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  // Trả về true khi đã gửi xong (hộp thoại tự đóng).
  async function rejectCompletion(reason) {
    const task = rejectTask
    if (!task) return false
    try {
      const data = await call(`${API}/tasks/${task.id}/completion/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      onChanged(data)
      setRejectTask(null)
      reload()
      return true
    } catch (e) {
      alert('Lỗi: ' + e.message)
      return false
    }
  }

  return { rejectTask, setRejectTask, changeStatus, confirmCompletion, rejectCompletion }
}
