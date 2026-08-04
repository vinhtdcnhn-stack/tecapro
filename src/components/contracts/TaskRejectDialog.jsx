import { useState } from 'react'

// Nạp bộ style của tab công việc HĐ: hộp thoại này dùng lại lớp .task-modal-* và các lớp
// "chờ xác nhận" (.task-await-*, .task-reject-note). Module Công việc phòng ban cũng dùng
// hộp thoại này, nên import ở đây để bên đó có đủ style mà không phải nhớ import thêm.
import './ContractTaskTab.css'
import Modal from '../common/Modal'

// ── Hộp thoại "Chưa đạt — yêu cầu làm lại" ───────────────────────────────────────
// Người GIAO việc (hoặc PM/admin) không đồng ý kết quả người thực hiện báo lên: bắt buộc
// nhập LÝ DO, việc quay lại "Đang thực hiện" và lý do được ghi vào dòng thời gian trao đổi
// của việc (người thực hiện nhận thông báo kèm nội dung).
// Props:
//   task      — công việc đang chờ xác nhận
//   onConfirm(reason) — gửi lý do; trả Promise<boolean> (true = xong, hộp thoại đã đóng)
//   onClose() — đóng hộp thoại
export default function TaskRejectDialog({ task, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleConfirm() {
    if (!reason.trim()) { setError('Vui lòng nhập lý do chưa hoàn thành.'); return }
    setSaving(true)
    const ok = await onConfirm(reason.trim())
    setSaving(false)
    if (!ok) setError('Không gửi được. Vui lòng thử lại.')
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="task-modal-overlay"
      contentClassName="task-modal task-transfer-modal"
      labelledBy="task-reject-title"
    >
      <div className="task-modal-header">
        <h3 id="task-reject-title">Chưa đạt — yêu cầu làm lại</h3>
        <button className="task-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      <div className="task-modal-body">
        <div className="task-subtask-banner">
          Công việc: <strong>{task?.title}</strong>
          <div className="task-transfer-hint">
            {task?.completion_requested_by_name
              ? <><strong>{task.completion_requested_by_name}</strong> đã báo hoàn thành việc này. </>
              : null}
            Nếu chưa đạt, việc sẽ quay lại <strong>"Đang thực hiện"</strong> và lý do bên dưới
            được ghi vào <strong>dòng thời gian trao đổi</strong> của việc.
          </div>
        </div>

        <div className="task-form-group">
          <label>Lý do chưa hoàn thành *</label>
          <textarea
            rows={4}
            autoFocus
            value={reason}
            onChange={e => { setReason(e.target.value); if (error) setError('') }}
            className={error ? 'has-error' : ''}
            placeholder="Nêu rõ phần còn thiếu / cần làm lại để người thực hiện biết phải xử lý gì"
          />
          {error && <span className="task-form-error">{error}</span>}
        </div>
      </div>

      <div className="task-modal-footer">
        <button className="task-modal-btn cancel" onClick={onClose}>Hủy</button>
        <button className="task-modal-btn save" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Đang gửi...' : 'Gửi yêu cầu làm lại'}
        </button>
      </div>
    </Modal>
  )
}
