import { useMemo, useState } from 'react'

import Modal from '../common/Modal'
import { isUserActive } from '../../lib/userStatus'

// ── Hộp thoại "Chuyển việc" ──────────────────────────────────────────────────────
// Người được giao (hoặc PM/admin, người tạo) chọn người khác để CHUYỂN việc cho họ.
// Hệ quả: chỉ đổi NGƯỜI THỰC HIỆN của chính việc này (không tạo việc con) và ghi nhật ký.
// Props:
//   task        — công việc đang chuyển
//   departments — [{ id, name }] để lọc người theo phòng ban
//   users       — [{ id, full_name, department_id }] danh sách người nhận
//   currentUser — người đang thao tác (loại khỏi danh sách để không tự chuyển cho mình)
//   onConfirm({ department_id, assigned_to, note }) — đổi người thực hiện; trả Promise<boolean>
//   onClose()   — đóng hộp thoại
export default function TaskTransferDialog({ task, departments = [], users = [], currentUser, onConfirm, onClose }) {
  const [deptId, setDeptId]   = useState(task?.department_id ? String(task.department_id) : '')
  const [assignTo, setAssign] = useState('')
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Người nhận: lọc theo phòng ban đã chọn; bỏ chính người đang chuyển, người đang
  // thực hiện hiện tại (chuyển cho họ là vô nghĩa) và người đã nghỉ việc.
  const candidates = useMemo(() => {
    const uid = Number(currentUser?.id)
    const cur = Number(task?.assigned_to)
    return users.filter(u =>
      Number(u.id) !== uid && Number(u.id) !== cur && isUserActive(u) &&
      (!deptId || String(u.department_id) === String(deptId))
    )
  }, [users, deptId, currentUser, task])

  function changeDept(val) {
    setDeptId(val)
    setAssign('')          // người cũ có thể không thuộc phòng ban mới
    if (error) setError('')
  }

  async function handleConfirm() {
    if (!assignTo) { setError('Vui lòng chọn người để chuyển việc.'); return }
    setSaving(true)
    const ok = await onConfirm({
      department_id: deptId || null,
      assigned_to: Number(assignTo),
      note: note.trim() || null,
    })
    setSaving(false)
    if (!ok) setError('Không thể chuyển việc. Vui lòng thử lại.')
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="task-modal-overlay"
      contentClassName="task-modal task-transfer-modal"
      labelledBy="task-transfer-title"
    >
      <div className="task-modal-header">
        <h3 id="task-transfer-title">Chuyển việc</h3>
        <button className="task-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      <div className="task-modal-body">
        <div className="task-subtask-banner">
          Chuyển công việc: <strong>{task?.title}</strong>
          <div className="task-transfer-hint">
            Công việc này sẽ được <strong>giao lại</strong> cho người bạn chọn
            {task?.assigned_to_name ? <> (hiện do <strong>{task.assigned_to_name}</strong> thực hiện)</> : null}.
            Toàn bộ quá trình giao/chuyển việc được ghi lại.
          </div>
        </div>

        <div className="task-form-row">
          <div className="task-form-group">
            <label>Phòng ban</label>
            <select value={deptId} onChange={e => changeDept(e.target.value)}>
              <option value="">-- Tất cả phòng ban --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="task-form-group">
            <label>Chuyển cho *</label>
            <select
              value={assignTo}
              onChange={e => { setAssign(e.target.value); if (error) setError('') }}
              className={error ? 'has-error' : ''}
            >
              <option value="">-- Chọn người --</option>
              {candidates.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            {candidates.length === 0 && (
              <span className="assign-hint">Không có người phù hợp ở phòng ban này</span>
            )}
            {error && <span className="task-form-error">{error}</span>}
          </div>
        </div>

        <div className="task-form-group">
          <label>Lý do chuyển (tùy chọn)</label>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú lý do chuyển việc — sẽ lưu vào nhật ký"
          />
        </div>
      </div>

      <div className="task-modal-footer">
        <button className="task-modal-btn cancel" onClick={onClose}>Hủy</button>
        <button className="task-modal-btn save" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Đang chuyển...' : 'Chuyển việc'}
        </button>
      </div>
    </Modal>
  )
}
