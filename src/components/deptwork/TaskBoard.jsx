import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import useIsMobile from '../contracts/useIsMobile'
import DeptWorkTaskModal from './DeptWorkTaskModal'
import TaskDetailDrawer from './TaskDetailDrawer'
import {
  fmtDate, statusClass, priorityClass, isOverdue, assigneesSummary,
} from './deptWorkUtils'

const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Chờ xử lý', label: 'Chờ xử lý' },
  { key: 'Đang thực hiện', label: 'Đang thực hiện' },
  { key: 'Hoàn thành', label: 'Hoàn thành' },
]
const STATUS_OPTS = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

export default function TaskBoard({ currentUser, members, teams, canManage }) {
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [detailId, setDetailId] = useState(null)

  const load = useCallback(async () => {
    try { setTasks(await fetch(`${API}/dept-work/tasks`).then(r => r.json())) }
    catch (e) { console.error('load dept-work tasks:', e) }
    finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(() => { load() }, [load])

  const visible = tasks.filter(t => filter === 'all' || t.status === filter)

  // Được đổi trạng thái nếu là head/deputy/admin HOẶC là nhóm trưởng của việc.
  const canChangeStatus = (t) =>
    canManage || t.assignees?.some(a => a.is_lead && a.assignee_id === currentUser?.id)

  // Trả về việc đã lưu (có id) để modal tải tệp đính kèm đang chờ; null nếu lỗi.
  async function handleSave(payload) {
    const url = editTask ? `${API}/dept-work/tasks/${editTask.id}` : `${API}/dept-work/tasks`
    const method = editTask ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lưu thất bại'); return null }
      return data
    } catch { alert('Có lỗi xảy ra.'); return null }
  }

  async function handleDelete(t) {
    if (!confirm(`Xóa công việc "${t.title}"?`)) return
    try {
      const res = await fetch(`${API}/dept-work/tasks/${t.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Xóa thất bại'); return }
      setTasks(prev => prev.filter(x => x.id !== t.id))
    } catch { alert('Có lỗi xảy ra.') }
  }

  async function handleStatus(t, status) {
    try {
      const res = await fetch(`${API}/dept-work/tasks/${t.id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Đổi trạng thái thất bại'); return }
      setTasks(prev => prev.map(x => x.id === t.id ? data : x))
    } catch { alert('Có lỗi xảy ra.') }
  }

  const openCreate = () => { setEditTask(null); setModalOpen(true) }
  const openEdit = (t) => { setEditTask(t); setModalOpen(true) }
  const openDetail = (t) => setDetailId(t.id)

  function StatusCell({ t }) {
    if (canChangeStatus(t)) {
      return (
        <select className={`dw-status-select ${statusClass(t.status)}`} value={t.status} onChange={e => handleStatus(t, e.target.value)}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    }
    return <span className={`dw-badge ${statusClass(t.status)}`}>{t.status}</span>
  }

  if (loading) return <p className="dash-empty">Đang tải công việc...</p>

  return (
    <div className="dw-board">
      <div className="dw-toolbar">
        <div className="dw-filters">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} className={`dw-filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <button className="add-btn" onClick={openCreate}>+ Thêm công việc</button>
      </div>

      {visible.length === 0 ? (
        <p className="dash-empty">Chưa có công việc nào.</p>
      ) : isMobile ? (
        <div className="dw-card-list">
          {visible.map(t => (
            <div key={t.id} className={`dw-task-card${isOverdue(t) ? ' dw-overdue' : ''}`} onClick={() => openDetail(t)}>
              <div className="dw-card-top">
                <span className="dw-card-title">{t.title}</span>
                <span className={`dw-badge ${statusClass(t.status)}`}>{t.status}</span>
              </div>
              <div className="dw-card-meta">
                {t.origin === 'customer' && <span className="dw-badge dw-badge-cust">KH</span>}
                {t.team_name && <span className="dw-chip">{t.team_name}</span>}
                <span className={`dw-chip ${priorityClass(t.priority)}`}>{t.priority}</span>
                <span className="dw-chip">Hạn: {fmtDate(t.due_date)}</span>
                {t.escalated && <span className="dw-badge dw-badge-esc">Đã đẩy cấp trên</span>}
              </div>
              <div className="dw-card-assignees">{assigneesSummary(t.assignees)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dw-table-wrap">
          <table className="dw-table">
            <thead>
              <tr>
                <th>Công việc</th><th>Người nhận</th><th>Ưu tiên</th><th>Hạn</th><th>Trạng thái</th>
                {canManage && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr key={t.id} className={isOverdue(t) ? 'dw-overdue' : ''}>
                  <td>
                    <button className="dw-link" onClick={() => openDetail(t)}>{t.title}</button>
                    <div className="dw-sub">
                      {t.origin === 'customer' && <span className="dw-badge dw-badge-cust">KH{t.customer_name ? `: ${t.customer_name}` : ''}</span>}
                      {t.team_name && <span className="dw-chip">{t.team_name}</span>}
                      {t.escalated && <span className="dw-badge dw-badge-esc">Đã đẩy cấp trên</span>}
                      {t.open_issue_count > 0 && <span className="dw-chip">⚠ {t.open_issue_count} vấn đề</span>}
                    </div>
                  </td>
                  <td>{assigneesSummary(t.assignees)}</td>
                  <td><span className={`dw-chip ${priorityClass(t.priority)}`}>{t.priority}</span></td>
                  <td>{fmtDate(t.due_date)}</td>
                  <td><StatusCell t={t} /></td>
                  {canManage && (
                    <td className="dw-actions">
                      <button className="edit-btn" onClick={() => openEdit(t)}>Sửa</button>
                      <button className="dw-del-btn" onClick={() => handleDelete(t)}>Xóa</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <TaskDetailDrawer
          taskId={detailId}
          currentUser={currentUser}
          canManage={canManage}
          members={members}
          onClose={() => setDetailId(null)}
          onEdit={(t) => { setDetailId(null); openEdit(t) }}
          onChanged={load}
        />
      )}

      {modalOpen && (
        <DeptWorkTaskModal
          task={editTask}
          members={members}
          teams={teams}
          canManage={canManage}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTask(null); load() }}
        />
      )}
    </div>
  )
}
