import { useState, useEffect, useCallback } from 'react'
import './ContractTaskTab.css'

import { API } from '../../config/api'
import { isOverdue } from './taskUtils'
import DeptGroup from './TaskDeptGroup'
import TaskModal from './TaskModal'
import EditGuard from './EditGuard'

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
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
  const groups = groupByDept(filtered)

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
        <EditGuard>
          <button className="task-add-btn" onClick={openCreate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm công việc
          </button>
        </EditGuard>
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

function groupByDept(tasks) {
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
