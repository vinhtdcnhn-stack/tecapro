import { useState, useEffect, useCallback } from 'react'
import './ContractTaskTab.css'

import { API } from '../../config/api'
import { isOverdue, groupByDept } from './taskUtils'
import DeptGroup from './TaskDeptGroup'
import TaskModal from './TaskModal'
import TaskGantt from './TaskGantt'
import EditGuard from './EditGuard'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractTaskTab({ contractId, currentUser }) {
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [departments, setDepts]   = useState([])
  const [users, setUsers]         = useState([])
  const [milestones, setMilestones] = useState([])  // mốc tiến độ HĐ (cho Gantt)
  const [filter, setFilter]       = useState('all')
  const [view, setView]           = useState('list')  // 'list' | 'gantt'
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask]   = useState(null)  // null = create mode
  const [collapsed, setCollapsed] = useState({})    // dept.id → bool

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [tRes, dRes, uRes, pRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/tasks`),
        fetch(`${API}/departments`),
        fetch(`${API}/users`),
        fetch(`${API}/contracts/${contractId}/progress`),
      ])
      const [tData, dData, uData, pData] = await Promise.all([tRes.json(), dRes.json(), uRes.json(), pRes.json()])
      setTasks(Array.isArray(tData) ? tData : [])
      setDepts(Array.isArray(dData) ? dData : [])
      setUsers(Array.isArray(uData) ? uData : [])
      setMilestones(Array.isArray(pData) ? pData : [])
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

  // ── Overdue count (cho nhãn bộ lọc) ──────────────────────────────────────────
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
          start_date:    task.start_date,
          due_date:      task.due_date,
          status:        newStatus,
          note:          task.note,
          dependencies:  task.dependencies || [],
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
        <div className="task-toolbar-right">
          <div className="task-view-seg">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Danh sách</button>
            <button className={view === 'gantt' ? 'active' : ''} onClick={() => setView('gantt')}>Gantt</button>
          </div>
          <EditGuard>
            <button className="task-add-btn" onClick={openCreate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm công việc
            </button>
          </EditGuard>
        </div>
      </div>

      {/* Nội dung: Danh sách hoặc Gantt */}
      {view === 'gantt' ? (
        <TaskGantt tasks={filtered} milestones={milestones} onEdit={openEdit} />
      ) : filtered.length === 0 ? (
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
          allTasks={tasks}
          milestones={milestones}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
