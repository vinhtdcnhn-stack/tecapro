import { useState, useEffect, useCallback } from 'react'
import './ContractTaskTab.css'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const PRIORITIES = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
const STATUSES   = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000)
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  return daysUntil(task.due_date) < 0
}

function isWarning(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  const d = daysUntil(task.due_date)
  return d >= 0 && d <= 3
}

function priorityClass(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' : p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
function statusClass(s) {
  return s === 'Chờ xử lý' ? 'status--waiting' : s === 'Đang thực hiện' ? 'status--doing' : s === 'Hoàn thành' ? 'status--done' : 'status--cancel'
}
function statusModalClass(s) {
  return s === 'Chờ xử lý' ? 'selected-waiting' : s === 'Đang thực hiện' ? 'selected-doing' : s === 'Hoàn thành' ? 'selected-done' : 'selected-cancel'
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractTaskTab({ contractId, currentUser }) {
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [departments, setDepts]   = useState([])
  const [users, setUsers]         = useState([])
  const [filter, setFilter]       = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask]   = useState(null)  // null = create mode
  const [collapsed, setCollapsed] = useState({})    // dept.id → bool

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [tRes, dRes, uRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/tasks`),
        fetch(`${API}/departments`),
        fetch(`${API}/users`),
      ])
      const [tData, dData, uData] = await Promise.all([tRes.json(), dRes.json(), uRes.json()])
      setTasks(Array.isArray(tData) ? tData : [])
      setDepts(Array.isArray(dData) ? dData : [])
      setUsers(Array.isArray(uData) ? uData : [])
    } catch (e) { console.error('load tasks:', e) }
    finally { setLoading(false) }
  }, [contractId])

  useEffect(() => { load() }, [load])

  // ── Filtered tasks ──────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    if (filter === 'waiting')  return t.status === 'Chờ xử lý'
    if (filter === 'doing')    return t.status === 'Đang thực hiện'
    if (filter === 'done')     return t.status === 'Hoàn thành'
    if (filter === 'overdue')  return isOverdue(t)
    return true
  })

  // ── Group by department ────────────────────────────────────────────────────
  const groups = groupByDept(filtered, departments)

  // ── Summary counts ──────────────────────────────────────────────────────────
  const total   = tasks.length
  const waiting = tasks.filter(t => t.status === 'Chờ xử lý').length
  const doing   = tasks.filter(t => t.status === 'Đang thực hiện').length
  const done    = tasks.filter(t => t.status === 'Hoàn thành').length
  const overdue = tasks.filter(isOverdue).length

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openCreate() { setEditTask(null); setModalOpen(true) }
  function openEdit(t)  { setEditTask(t);    setModalOpen(true) }

  async function handleSave(formData) {
    try {
      const url    = editTask ? `${API}/tasks/${editTask.id}` : `${API}/contracts/${contractId}/tasks`
      const method = editTask ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, created_by: currentUser?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu')

      setTasks(prev => editTask
        ? prev.map(t => t.id === editTask.id ? data : t)
        : [...prev, data]
      )
      return data  // modal tự đóng sau khi upload xong
    } catch (e) {
      alert('Lỗi: ' + e.message)
      return null
    }
  }

  function handleModalClose() {
    setModalOpen(false)
    load()  // reload để cập nhật attachment_count
  }

  async function handleDelete(task) {
    if (!confirm(`Xóa công việc "${task.title}"?`)) return
    try {
      await fetch(`${API}/tasks/${task.id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== task.id))
    } catch { alert('Không thể xóa.') }
  }

  async function handleStatusChange(task, newStatus) {
    try {
      const res = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         task.title,
          description:   task.description,
          department_id: task.department_id,
          assigned_to:   task.assigned_to,
          priority:      task.priority,
          due_date:      task.due_date,
          status:        newStatus,
          note:          task.note,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTasks(prev => prev.map(t => t.id === task.id ? data : t))
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  function toggleCollapse(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <div className="task-loading">Đang tải...</div>

  return (
    <div className="task-tab">
      {/* Summary */}
      <div className="task-summary">
        <div className="task-card task-card--total">
          <div className="task-card-label">Tổng công việc</div>
          <div className="task-card-value">{total}</div>
          <div className="task-card-sub">trong hợp đồng này</div>
        </div>
        <div className="task-card task-card--waiting">
          <div className="task-card-label">Chờ xử lý</div>
          <div className="task-card-value">{waiting}</div>
          <div className="task-card-sub">chưa bắt đầu</div>
        </div>
        <div className="task-card task-card--doing">
          <div className="task-card-label">Đang thực hiện</div>
          <div className="task-card-value">{doing}</div>
          <div className="task-card-sub">công việc</div>
        </div>
        <div className="task-card task-card--done">
          <div className="task-card-label">Hoàn thành</div>
          <div className="task-card-value">{done}</div>
          <div className="task-card-sub">{total > 0 ? `${Math.round(done/total*100)}%` : '0%'} tiến độ</div>
        </div>
        <div className="task-card task-card--overdue">
          <div className="task-card-label">Quá hạn</div>
          <div className="task-card-value">{overdue}</div>
          <div className="task-card-sub">{overdue > 0 ? 'Cần xử lý ngay' : 'Không có'}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="task-toolbar">
        <div className="task-filters">
          {[
            { key: 'all',     label: 'Tất cả' },
            { key: 'waiting', label: 'Chờ xử lý' },
            { key: 'doing',   label: 'Đang thực hiện' },
            { key: 'done',    label: 'Hoàn thành' },
            { key: 'overdue', label: `Quá hạn${overdue > 0 ? ` (${overdue})` : ''}`, extra: 'filter-overdue' },
          ].map(f => (
            <button
              key={f.key}
              className={`task-filter-btn ${f.extra || ''} ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="task-add-btn" onClick={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm công việc
        </button>
      </div>

      {/* Groups */}
      {filtered.length === 0 ? (
        <div className="task-empty">
          {filter === 'all'
            ? 'Chưa có công việc nào. Nhấn Thêm công việc để bắt đầu.'
            : 'Không có công việc nào khớp với bộ lọc.'}
        </div>
      ) : groups.map(group => (
        <DeptGroup
          key={group.key}
          group={group}
          collapsed={!!collapsed[group.key]}
          onToggle={() => toggleCollapse(group.key)}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          users={users}
        />
      ))}

      {/* Modal */}
      {modalOpen && (
        <TaskModal
          task={editTask}
          departments={departments}
          users={users}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

// ── Group tasks by department ─────────────────────────────────────────────────

function groupByDept(tasks, departments) {
  const map = new Map()

  // Ensure "Chưa phân phòng" group exists last
  for (const t of tasks) {
    const key  = t.department_id ?? 'none'
    const name = t.department_name ?? 'Chưa phân phòng ban'
    if (!map.has(key)) map.set(key, { key, name, tasks: [] })
    map.get(key).tasks.push(t)
  }

  return [...map.values()].sort((a, b) => {
    if (a.key === 'none') return 1
    if (b.key === 'none') return -1
    return 0
  })
}

// ── Department group ──────────────────────────────────────────────────────────

function DeptGroup({ group, collapsed, onToggle, onEdit, onDelete, onStatusChange, users }) {
  const total    = group.tasks.length
  const done     = group.tasks.filter(t => t.status === 'Hoàn thành').length
  const inDoing  = group.tasks.filter(t => t.status === 'Đang thực hiện').length
  const overdues = group.tasks.filter(isOverdue).length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0

  const barColor = pct === 100 ? '#16a34a' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#e5e7eb'

  return (
    <div className={`task-dept-group ${group.key === 'none' ? 'task-nodept' : ''}`}>
      <div className="task-dept-header" onClick={onToggle}>
        <span className={`task-dept-toggle ${collapsed ? '' : 'open'}`}>▶</span>
        <span className="task-dept-name">
          {group.name}
          <span>({total} việc)</span>
        </span>
        <div className="task-dept-progress">
          <div className="task-dept-progress-bar">
            <div className="task-dept-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <span className="task-dept-progress-pct">{pct}%</span>
        </div>
        <div className="task-dept-badges">
          {inDoing > 0 && <span className="dept-badge dept-badge--doing">{inDoing} đang làm</span>}
          {overdues > 0 && <span className="dept-badge dept-badge--overdue">{overdues} quá hạn</span>}
        </div>
      </div>

      {!collapsed && (
        <div className="task-table-wrapper">
          <table className="task-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Công việc</th>
                <th style={{ width: 100 }}>Ưu tiên</th>
                <th style={{ width: 160 }}>Người thực hiện</th>
                <th style={{ width: 140 }}>Thời hạn</th>
                <th style={{ width: 130 }}>Trạng thái</th>
                <th style={{ width: 76 }}></th>
              </tr>
            </thead>
            <tbody>
              {group.tasks.map((task, idx) => (
                <TaskRow
                  key={task.id}
                  idx={idx}
                  task={task}
                  users={users}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                  onStatusChange={onStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ idx, task, users, onEdit, onDelete, onStatusChange }) {
  const overdue  = isOverdue(task)
  const warn     = isWarning(task)
  const days     = daysUntil(task.due_date)

  const rowClass = [
    overdue ? 'task-row--overdue' : '',
    warn    ? 'task-row--warning' : '',
    task.status === 'Hoàn thành' ? 'task-row--done' : '',
  ].filter(Boolean).join(' ')

  return (
    <tr className={rowClass}>
      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>

      <td>
        <div className="task-title-cell">
          <span className="task-title">{task.title}</span>
          {task.description && <span className="task-desc-preview">{task.description}</span>}
          {Array.isArray(task.attachments) && task.attachments.map(att => (
            <a
              key={att.id}
              href={`${API.replace('/api', '')}${att.file_path}`}
              download={att.file_name}
              className="task-attach-badge task-attach-badge--link"
              title={`Tải về: ${att.file_name}`}
              onClick={e => e.stopPropagation()}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
              <span className="task-attach-badge-name">{att.file_name}</span>
            </a>
          ))}
        </div>
      </td>

      <td>
        <span className={`priority-badge ${priorityClass(task.priority)}`}>
          {task.priority}
        </span>
      </td>

      <td>
        {task.assigned_to_name ? (
          <div className="assignee-cell">
            <div className="assignee-avatar">{initials(task.assigned_to_name)}</div>
            <span className="assignee-name">{task.assigned_to_name}</span>
          </div>
        ) : (
          <span className="assignee-empty">Chưa assign</span>
        )}
      </td>

      <td>
        <div className="due-date-cell">
          <span className="due-date-text">{fmtDate(task.due_date)}</span>
          {overdue && (
            <span className="due-date-error">
              Quá hạn {Math.abs(days)} ngày
            </span>
          )}
          {warn && !overdue && (
            <span className="due-date-warn">
              Còn {days} ngày
            </span>
          )}
        </div>
      </td>

      <td>
        <select
          value={task.status}
          onChange={e => onStatusChange(task, e.target.value)}
          className={`status-badge-task ${statusClass(task.status)}`}
          style={{ border: 'none', cursor: 'pointer', background: 'transparent', fontWeight: 600, fontSize: 11, padding: '3px 8px' }}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      <td>
        <div className="task-actions">
          <button className="task-act-btn edit" onClick={onEdit} title="Chỉnh sửa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button className="task-act-btn delete" onClick={onDelete} title="Xóa">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Task modal (create / edit) ────────────────────────────────────────────────

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TaskModal({ task, departments, users, currentUser, onSave, onClose }) {
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
    <div className="task-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-modal">
        <div className="task-modal-header">
          <h3>{isEdit ? 'Cập nhật công việc' : 'Thêm công việc mới'}</h3>
          <button className="task-modal-close" onClick={onClose}>✕</button>
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
              <input
                type="date"
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
                    <a href={att.file_path} target="_blank" rel="noreferrer" className="attach-name" title={att.file_name}>
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
      </div>
    </div>
  )
}
