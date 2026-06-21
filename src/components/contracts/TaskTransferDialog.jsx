import { useMemo, useState } from 'react'

import Modal from '../common/Modal'

// ── Hộp thoại "Chuyển việc" ──────────────────────────────────────────────────────
// Người được giao một công việc chọn người khác để chuyển việc cho họ. Hệ quả: tạo
// một VIỆC CON với nội dung giống việc cha nhưng người thực hiện là người được chọn.
// Props:
//   task        — công việc đang chuyển (việc cha của việc con sắp tạo)
//   departments — [{ id, name }] để lọc người theo phòng ban
//   users       — [{ id, full_name, department_id }] danh sách người nhận
//   currentUser — người đang thao tác (loại khỏi danh sách để không tự chuyển cho mình)
//   onConfirm({ department_id, assigned_to }) — tạo việc con; trả Promise, null khi lỗi
//   onClose()   — đóng hộp thoại
export default function TaskTransferDialog({ task, departments = [], users = [], currentUser, onConfirm, onClose }) {
  const [deptId, setDeptId]   = useState(task?.department_id ? String(task.department_id) : '')
  const [assignTo, setAssign] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Người nhận: lọc theo phòng ban đã chọn; luôn bỏ chính người đang chuyển.
  const candidates = useMemo(() => {
    const uid = Number(currentUser?.id)
    return users.filter(u =>
      Number(u.id) !== uid &&
      (!deptId || String(u.department_id) === String(deptId))
    )
  }, [users, deptId, currentUser])

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
            Hệ thống sẽ tạo một <strong>việc con</strong> với nội dung giống công việc này,
            giao cho người bạn chọn.
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
