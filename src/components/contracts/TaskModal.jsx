import { useState, useEffect, useMemo } from 'react'

import { API } from '../../config/api'
import Modal from '../common/Modal'
import { PRIORITIES, STATUSES, statusModalClass, resolveTaskStart, dayPart, fmtDate, addDaysISO, todayISO } from './taskUtils'
import DateInput from './DateInput'

// ── Task modal (create / edit) ────────────────────────────────────────────────

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TaskModal({ task, parentTask = null, departments, users, allTasks = [], milestones = [], currentUser, onSave, onClose }) {
  const isEdit = !!task
  const isSubtask = !isEdit && !!parentTask
  // Việc cha (tạo việc con: từ prop; sửa việc con: tra từ allTasks) → cho phép neo ngày theo cha.
  const parentOf = parentTask || allTasks.find(t => String(t.id) === String(task?.parent_task_id)) || null
  const hasParent = !!parentOf
  // Đổi người thực hiện: khi TẠO ai cũng được; khi SỬA chỉ người tạo việc (hoặc admin).
  const canEditAssignee = !isEdit
    || Number(currentUser?.role) === 1
    || Number(task?.created_by) === Number(currentUser?.id)

  const [form, setForm] = useState({
    title:         task?.title         ?? '',
    description:   task?.description   ?? '',
    department_id: task?.department_id ?? '',
    assigned_to:   task?.assigned_to   ?? '',
    priority:      task?.priority      ?? 'Bình thường',
    start_date:    task?.start_date?.slice(0, 10) ?? '',
    due_date:      task?.due_date?.slice(0, 10) ?? '',
    status:        task?.status        ?? 'Chờ xử lý',
    completed_at:  task?.completed_at?.slice(0, 10) ?? '',
    note:          task?.note          ?? '',
  })
  const [errors, setErrors]         = useState({})
  const [saving, setSaving]         = useState(false)
  const [attachments, setAttachments] = useState([])   // existing (edit mode)
  const [pendingFiles, setPending]  = useState([])     // queued for upload

  // ── Lịch & ràng buộc bắt đầu ──
  const initialDeps = (task?.dependencies || []).map(d => ({
    dep_type: d.dep_type || 'task',
    dep_task_id: d.dep_task_id ?? '',
    dep_progress_id: d.dep_progress_id ?? '',
    offset_days: d.offset_days ?? 0,
  }))
  const [startMode, setStartMode] = useState(
    task?.parent_start_offset != null ? 'parent' : (initialDeps.length ? 'deps' : 'fixed')
  )  // 'fixed' | 'deps' | 'parent'
  const [deps, setDeps]           = useState(initialDeps)
  const [parentOffset, setParentOffset] = useState(task?.parent_start_offset ?? 0)

  // ── Chế độ thời hạn hoàn thành ──
  // 'fixed' = chọn ngày cố định · 'duration' = làm trong N ngày (gồm cả ngày bắt đầu).
  const [dueMode, setDueMode]     = useState(task?.duration_days != null ? 'duration' : 'fixed')
  const [duration, setDuration]   = useState(task?.duration_days ?? 1)

  function addDep()      { setDeps(prev => [...prev, { dep_type: 'task', dep_task_id: '', dep_progress_id: '', offset_days: 0 }]) }
  function removeDep(i)  { setDeps(prev => prev.filter((_, j) => j !== i)) }
  function setDep(i, field, val) {
    setDeps(prev => prev.map((d, j) => j === i
      ? { ...d, [field]: val, ...(field === 'dep_type' ? { dep_task_id: '', dep_progress_id: '' } : {}) }
      : d))
  }

  // Bộ phụ thuộc hợp lệ (đã chọn mục tiêu) để lưu + tính ngày bắt đầu dự kiến.
  const cleanDeps = startMode === 'deps'
    ? deps
        .filter(d => d.dep_type === 'task' ? d.dep_task_id : d.dep_progress_id)
        .map(d => ({
          dep_type: d.dep_type,
          dep_task_id: d.dep_type === 'task' ? Number(d.dep_task_id) : null,
          dep_progress_id: d.dep_type === 'milestone' ? Number(d.dep_progress_id) : null,
          offset_days: Number(d.offset_days) || 0,
        }))
    : []

  // Công việc khác (loại trừ chính nó) + mốc tiến độ để chọn làm "bước trước".
  const otherTasks = allTasks.filter(t => t.id !== task?.id)
  const tasksById  = useMemo(() => new Map(allTasks.map(t => [String(t.id), t])), [allTasks])
  const msById     = useMemo(() => new Map(milestones.map(m => [String(m.id), m])), [milestones])

  // Ngày bắt đầu hiệu lực (từ ngày cố định / bước trước / việc cha) — KHÔNG fallback về due
  // để tránh vòng lặp khi due được suy ra từ start.
  const baseStart = resolveTaskStart(
    {
      ...task,
      parent_task_id: parentOf?.id ?? task?.parent_task_id ?? null,
      parent_start_offset: startMode === 'parent' ? (Number(parentOffset) || 0) : null,
      start_date: startMode === 'fixed' ? form.start_date : null,
      dependencies: startMode === 'deps' ? cleanDeps : [],
    },
    tasksById, msById,
  )
  // Ngày bắt đầu dự kiến (read-only) hiển thị cho người dùng.
  const previewStart = baseStart || dayPart(form.due_date)

  // Thời hạn hoàn thành hiệu lực: chế độ duration → ngày bắt đầu + (N-1) ngày (gồm cả ngày bắt đầu);
  // ngược lại → ngày cố định.
  const durDays       = Math.max(1, Number(duration) || 1)
  const computedDue   = baseStart ? addDaysISO(baseStart, durDays - 1) : null
  const effectiveDue  = dueMode === 'duration' ? computedDue : (form.due_date || null)

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
      // Reset assigned_to when dept changes (user may not belong to new dept).
      // Bỏ qua nếu không có quyền đổi assignee → giữ nguyên người thực hiện cũ.
      if (field === 'department_id' && canEditAssignee) next.assigned_to = ''
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  // Đổi trạng thái: khi chuyển sang Hoàn thành mà chưa có ngày → mặc định hôm nay.
  function setStatus(s) {
    setForm(prev => ({
      ...prev,
      status: s,
      completed_at: s === 'Hoàn thành' ? (prev.completed_at || todayISO()) : prev.completed_at,
    }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim())  e.title    = 'Tên công việc không được để trống'
    if (dueMode === 'duration') {
      if (!baseStart)        e.due_date = 'Cần có ngày bắt đầu (cố định hoặc bước trước) để tính thời hạn'
    } else if (!form.due_date) {
      e.due_date = 'Vui lòng chọn thời hạn hoàn thành'
    }
    if (!form.department_id) e.department_id = 'Vui lòng chọn phòng ban'
    // Ngày bắt đầu phải trước (hoặc bằng) ngày hoàn thành.
    if (!e.due_date && previewStart && effectiveDue && previewStart > dayPart(effectiveDue)) {
      e.due_date = 'Ngày hoàn thành phải sau ngày bắt đầu'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    const payload = {
      ...form,
      start_date: startMode === 'fixed' ? (form.start_date || null) : null,
      due_date: effectiveDue,
      duration_days: dueMode === 'duration' ? durDays : null,
      dependencies: startMode === 'deps' ? cleanDeps : [],
      parent_start_offset: startMode === 'parent' ? (Number(parentOffset) || 0) : null,
    }
    const savedTask = await onSave(payload)
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
          <h3 id="task-modal-title">{isEdit ? 'Cập nhật công việc' : isSubtask ? 'Thêm công việc con' : 'Thêm công việc mới'}</h3>
          <button className="task-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="task-modal-body">
          {isSubtask && (
            <div className="task-subtask-banner">
              Việc con của: <strong>{parentTask.title}</strong>
            </div>
          )}
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
              {canEditAssignee ? (
                <>
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
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={task?.assigned_to_name || 'Chưa assign'}
                    disabled
                  />
                  <span className="assign-hint">Chỉ người tạo công việc mới được đổi người thực hiện</span>
                </>
              )}
            </div>
          </div>

          {/* Priority + Status */}
          <div className="task-form-row">
            <div className="task-form-group">
              <label>Mức độ ưu tiên</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="task-form-group">
              <label>Trạng thái</label>
              <div className="status-radio-group">
                {STATUSES.map(s => (
                  <div
                    key={s}
                    className={`status-radio-opt ${form.status === s ? statusModalClass(s) : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Lịch trình: Bắt đầu → Hoàn thành ─────────────────────── */}
          <div className="task-sched-section">
            <div className="task-sched-title">Lịch trình</div>

            {/* 1) Bắt đầu */}
            <div className="task-form-row">
              <div className="task-form-group full">
                <label>Bắt đầu</label>
                <div className="task-start-mode">
                  <label className={startMode === 'fixed' ? 'active' : ''}>
                    <input type="radio" name="startMode" checked={startMode === 'fixed'} onChange={() => setStartMode('fixed')} />
                    Ngày cố định
                  </label>
                  <label className={startMode === 'deps' ? 'active' : ''}>
                    <input type="radio" name="startMode" checked={startMode === 'deps'} onChange={() => setStartMode('deps')} />
                    Sau khi bước trước hoàn thành
                  </label>
                  {hasParent && (
                    <label className={startMode === 'parent' ? 'active' : ''}>
                      <input type="radio" name="startMode" checked={startMode === 'parent'} onChange={() => setStartMode('parent')} />
                      Theo việc cha
                    </label>
                  )}
                </div>

                {startMode === 'fixed' ? (
                  <div style={{ maxWidth: 220, marginTop: 8 }}>
                    <DateInput value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                  </div>
                ) : startMode === 'parent' ? (
                  <div className="task-parent-start">
                    <div className="task-parent-start-name">
                      Bám theo ngày bắt đầu của: <strong>{parentOf?.title || '—'}</strong>
                    </div>
                    <div className="task-due-offset">
                      <input
                        type="number"
                        min="0"
                        value={parentOffset}
                        onChange={e => setParentOffset(e.target.value)}
                      />
                      <span>ngày sau khi việc cha bắt đầu (0 = cùng ngày)</span>
                    </div>
                  </div>
                ) : (
                  <div className="task-deps">
                    {deps.length === 0 && (
                      <div className="task-deps-empty">Chưa có bước trước. Thêm bước để công việc tự bắt đầu sau khi bước đó xong.</div>
                    )}
                    {deps.map((d, i) => (
                      <div key={i} className="task-dep-row">
                        <select value={d.dep_type} onChange={e => setDep(i, 'dep_type', e.target.value)}>
                          <option value="task">Công việc</option>
                          <option value="milestone">Mốc tiến độ HĐ</option>
                        </select>
                        {d.dep_type === 'task' ? (
                          <select value={d.dep_task_id} onChange={e => setDep(i, 'dep_task_id', e.target.value)}>
                            <option value="">-- Chọn công việc --</option>
                            {otherTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </select>
                        ) : (
                          <select value={d.dep_progress_id} onChange={e => setDep(i, 'dep_progress_id', e.target.value)}>
                            <option value="">-- Chọn mốc --</option>
                            {milestones.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.bb_name || m.bb_code || `Mốc #${m.id}`}{m.planned_date ? ` (${fmtDate(m.planned_date)})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="task-dep-offset">
                          <input type="number" value={d.offset_days}
                            onChange={e => setDep(i, 'offset_days', e.target.value)} />
                          <span>ngày sau</span>
                        </div>
                        <button type="button" className="task-dep-del" onClick={() => removeDep(i)} title="Xóa bước trước">✕</button>
                      </div>
                    ))}
                    <button type="button" className="task-dep-add" onClick={addDep}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                      Thêm bước trước
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2) Thời hạn hoàn thành */}
            <div className="task-form-row">
              <div className="task-form-group full">
                <label>Thời hạn hoàn thành *</label>
                <div className="task-due-mode">
                  <label className={dueMode === 'fixed' ? 'active' : ''}>
                    <input type="radio" name="dueMode" checked={dueMode === 'fixed'} onChange={() => setDueMode('fixed')} />
                    Ngày cố định
                  </label>
                  <label className={dueMode === 'duration' ? 'active' : ''}>
                    <input type="radio" name="dueMode" checked={dueMode === 'duration'} onChange={() => setDueMode('duration')} />
                    Theo ngày bắt đầu
                  </label>
                </div>

                {dueMode === 'fixed' ? (
                  <div style={{ maxWidth: 220 }}>
                    <DateInput
                      value={form.due_date}
                      onChange={e => set('due_date', e.target.value)}
                      className={errors.due_date ? 'has-error' : ''}
                    />
                  </div>
                ) : (
                  <div className="task-due-offset">
                    <input
                      type="number"
                      min="1"
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      className={errors.due_date ? 'has-error' : ''}
                    />
                    <span>ngày (tính cả ngày bắt đầu)</span>
                  </div>
                )}
                {errors.due_date && <span className="task-form-error">{errors.due_date}</span>}
              </div>
            </div>

            {/* Tóm tắt lịch dự kiến */}
            <div className="task-sched-summary">
              <span>Bắt đầu dự kiến: <strong>{previewStart ? fmtDate(previewStart) : '—'}</strong></span>
              <span className="task-sched-arrow">→</span>
              <span>Hạn hoàn thành: <strong>{effectiveDue ? fmtDate(effectiveDue) : '—'}</strong></span>
              {previewStart && effectiveDue && previewStart > dayPart(effectiveDue) && (
                <span className="task-start-warn"> ⚠ bắt đầu sau hạn hoàn thành</span>
              )}
            </div>
          </div>

          {/* Ngày hoàn thành (chỉ khi trạng thái = Hoàn thành) */}
          {form.status === 'Hoàn thành' && (
            <div className="task-form-row">
              <div className="task-form-group">
                <label>Ngày hoàn thành</label>
                <DateInput value={form.completed_at} onChange={e => set('completed_at', e.target.value)} />
              </div>
            </div>
          )}

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
