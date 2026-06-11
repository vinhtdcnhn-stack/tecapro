import { useState, useEffect } from 'react'

import { API } from '../../config/api'
import Modal from '../common/Modal'
import { PRIORITIES, STATUSES, statusModalClass } from './taskUtils'
import DateInput from './DateInput'

// ── Task modal (create / edit) ────────────────────────────────────────────────

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TaskModal({ task, departments, users, currentUser, onSave, onClose }) {
  const isEdit = !!task

  const [form, setForm] = useState({
    title:         task?.title         ?? '',
    description:   task?.description   ?? '',
    department_id: task?.department_id ?? '',
    assigned_to:   task?.assigned_to   ?? '',
    priority:      task?.priority      ?? 'Bình thường',
    due_date:      task?.due_date?.slice(0, 10) ?? '',
    status:        task?.status        ?? 'Chờ xử lý',
    note:          task?.note          ?? '',
  })
  const [errors, setErrors]         = useState({})
  const [saving, setSaving]         = useState(false)
  const [attachments, setAttachments] = useState([])   // existing (edit mode)
  const [pendingFiles, setPending]  = useState([])     // queued for upload

  useEffect(() => {
    if (isEdit && task.id) {
      fetch(`${API}/tasks/${task.id}/attachments`)
        .then(r => r.json())
        .then(data => setAttachments(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [isEdit, task?.id])

  // Filter users by selected department
  const deptUsers = form.department_id
    ? users.filter(u => String(u.department_id) === String(form.department_id))
    : users

  function set(field, val) {
    setForm(prev => {
      const next = { ...prev, [field]: val }
      // Reset assigned_to when dept changes (user may not belong to new dept)
      if (field === 'department_id') next.assigned_to = ''
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim())  e.title    = 'Tên công việc không được để trống'
    if (!form.due_date)      e.due_date = 'Vui lòng chọn thời hạn hoàn thành'
    if (!form.department_id) e.department_id = 'Vui lòng chọn phòng ban'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    const savedTask = await onSave(form)
    if (!savedTask) { setSaving(false); return }

    if (pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('file', file)
        if (currentUser?.id) fd.append('uploaded_by', String(currentUser.id))
        try {
          await fetch(`${API}/tasks/${savedTask.id}/attachments`, { method: 'POST', body: fd })
        } catch { /* tiếp tục upload file khác nếu 1 file lỗi */ }
      }
    }

    setSaving(false)
    onClose()
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPending(prev => [...prev, ...files])
    e.target.value = ''
  }

  async function handleDeleteAttachment(att) {
    if (!confirm(`Xóa file "${att.file_name}"?`)) return
    try {
      await fetch(`${API}/task-attachments/${att.id}`, { method: 'DELETE' })
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch { alert('Không thể xóa file.') }
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="task-modal-overlay"
      contentClassName="task-modal"
      labelledBy="task-modal-title"
    >
        <div className="task-modal-header">
          <h3 id="task-modal-title">{isEdit ? 'Cập nhật công việc' : 'Thêm công việc mới'}</h3>
          <button className="task-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="task-modal-body">
          {/* Title */}
          <div className="task-form-row">
            <div className="task-form-group full">
              <label>Tên công việc *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Nhập tên công việc..."
                className={errors.title ? 'has-error' : ''}
              />
              {errors.title && <span className="task-form-error">{errors.title}</span>}
            </div>
          </div>

          {/* Description */}
          <div className="task-form-row">
            <div className="task-form-group full">
              <label>Mô tả</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Mô tả chi tiết yêu cầu công việc..."
              />
            </div>
          </div>

          {/* Dept + Assigned */}
          <div className="task-form-row">
            <div className="task-form-group">
              <label>Phòng ban phụ trách *</label>
              <select
                value={form.department_id}
                onChange={e => set('department_id', e.target.value)}
                className={errors.department_id ? 'has-error' : ''}
              >
                <option value="">-- Chọn phòng ban --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {errors.department_id && <span className="task-form-error">{errors.department_id}</span>}
            </div>
            <div className="task-form-group">
              <label>Người thực hiện</label>
              <select
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
              >
                <option value="">-- Chưa assign --</option>
                {deptUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
              {form.department_id && deptUsers.length === 0 && (
                <span className="assign-hint">Phòng ban này chưa có nhân viên</span>
              )}
              {!form.department_id && (
                <span className="assign-hint">Chọn phòng ban để lọc nhân viên</span>
              )}
            </div>
          </div>

          {/* Priority + Due date */}
          <div className="task-form-row">
            <div className="task-form-group">
              <label>Mức độ ưu tiên</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="task-form-group">
              <label>Thời hạn hoàn thành *</label>
              <DateInput
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                className={errors.due_date ? 'has-error' : ''}
              />
              {errors.due_date && <span className="task-form-error">{errors.due_date}</span>}
            </div>
          </div>

          {/* Status */}
          <div className="task-form-row">
            <div className="task-form-group full">
              <label>Trạng thái</label>
              <div className="status-radio-group">
                {STATUSES.map(s => (
                  <div
                    key={s}
                    className={`status-radio-opt ${form.status === s ? statusModalClass(s) : ''}`}
                    onClick={() => set('status', s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="task-form-row">
            <div className="task-form-group full">
              <label>Ghi chú</label>
              <textarea
                rows={2}
                value={form.note}
                onChange={e => set('note', e.target.value)}
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="task-form-row">
            <div className="task-form-group full">
              <label>Tài liệu đính kèm</label>
              <div className="task-attach-section">
                {/* Existing files (edit mode) */}
                {attachments.map(att => (
                  <div key={att.id} className="task-attach-item task-attach-item--saved">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="attach-icon"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                    <a
                      href={att.file_path}
                      target={att.file_name.toLowerCase().endsWith('.pdf') ? '_blank' : undefined}
                      rel="noreferrer"
                      download={att.file_name.toLowerCase().endsWith('.pdf') ? undefined : att.file_name}
                      className="attach-name"
                      title={att.file_name}
                    >
                      {att.file_name}
                    </a>
                    <span className="attach-size">{fmtSize(att.file_size)}</span>
                    <button className="attach-del-btn" onClick={() => handleDeleteAttachment(att)} title="Xóa">✕</button>
                  </div>
                ))}

                {/* Pending files */}
                {pendingFiles.map((file, i) => (
                  <div key={i} className="task-attach-item task-attach-item--pending">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="attach-icon"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                    <span className="attach-name">{file.name}</span>
                    <span className="attach-size">{fmtSize(file.size)}</span>
                    <button className="attach-del-btn" onClick={() => setPending(prev => prev.filter((_, j) => j !== i))} title="Bỏ">✕</button>
                  </div>
                ))}

                {/* Upload button */}
                <label className="task-attach-add-btn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                  Chọn file
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="task-modal-footer">
          <button className="task-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="task-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm công việc'}
          </button>
        </div>
    </Modal>
  )
}
