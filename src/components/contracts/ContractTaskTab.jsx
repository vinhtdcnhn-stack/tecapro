import { useState, useEffect, useCallback, useMemo } from 'react'
import './ContractTaskTab.css'

import { API } from '../../config/api'
import { isOverdue, groupByDept, groupByAssignee, buildTaskTree, visibleTaskIds, buildTaskCopyText, copyToClipboard, transferredParentIds } from './taskUtils'
import { useCanEdit } from '../../context/ContractPermContext'
import DeptGroup from './TaskDeptGroup'
import TaskModal from './TaskModal'
import TaskGantt from './TaskGantt'
import TaskContextMenu from './TaskContextMenu'
import TaskTransferDialog from './TaskTransferDialog'
import EditGuard from './EditGuard'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractTaskTab({ contractId, currentUser, contract = null }) {
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [departments, setDepts]   = useState([])
  const [users, setUsers]         = useState([])
  const [milestones, setMilestones] = useState([])  // mốc tiến độ HĐ (cho Gantt)
  const [filter, setFilter]       = useState('all')
  const [view, setView]           = useState('list')  // 'list' | 'gantt'
  const [groupBy, setGroupBy]     = useState('department')  // 'department' | 'assignee' | 'none' (chế độ danh sách)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask]   = useState(null)  // null = create mode
  const [parentTask, setParentTask] = useState(null) // ≠ null = đang tạo việc con
  const [collapsed, setCollapsed] = useState({})    // dept.key → bool
  const [collapsedTask, setCollapsedTask] = useState({}) // task.id → bool (thu/mở việc con)
  const [ctxMenu, setCtxMenu]     = useState(null)  // { x, y, task } | null — menu chuột phải
  const [transferTask, setTransferTask] = useState(null)  // ≠ null = đang mở hộp thoại chuyển việc
  const canEdit = useCanEdit()

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

  // ── Cây công việc + bộ lọc (giữ tổ tiên để cây liền mạch) ────────────────────
  const { roots, childrenByParent, byId } = buildTaskTree(tasks)
  const matchFn = (t) => {
    if (filter === 'waiting')  return t.status === 'Chờ xử lý'
    if (filter === 'doing')    return t.status === 'Đang thực hiện'
    if (filter === 'done')     return t.status === 'Hoàn thành'
    if (filter === 'overdue')  return isOverdue(t)
    return true
  }
  const visible = filter === 'all' ? null : visibleTaskIds(tasks, matchFn)
  const visibleRoots = visible ? roots.filter(r => visible.has(String(r.id))) : roots
  const hasVisible = visible ? visible.size > 0 : tasks.length > 0

  // ── Mặc định THU các nhánh "chuyển việc" (việc cha có việc con trùng tên) ──────
  // Suy ra lúc render (không dùng effect): nhánh chuyển việc thu sẵn, người dùng tự bung
  // khi cần — thao tác bung/thu (collapsedTask) đè lên mặc định.
  const transferredIds = useMemo(() => transferredParentIds(tasks), [tasks])
  const effectiveCollapsedTask = useMemo(() => {
    const map = {}
    for (const id of transferredIds) map[id] = true
    return { ...map, ...collapsedTask }
  }, [transferredIds, collapsedTask])

  // ── Nhóm việc gốc (việc con lồng dưới cha) — theo bộ chọn như Gantt ──────────
  const flat = groupBy === 'none'
  const groups = flat
    ? [{ key: '__all__', name: '', tasks: visibleRoots }]
    : groupBy === 'assignee'
      ? groupByAssignee(visibleRoots)
      : groupByDept(visibleRoots)

  // ── Overdue count (cho nhãn bộ lọc) ──────────────────────────────────────────
  const overdue = tasks.filter(isOverdue).length

  // ── Quyền theo dòng (khớp backend canCreateTask/canWriteTask) ─────────────────
  const uid = Number(currentUser?.id)
  const canAddSub  = (task) => canEdit || Number(task.assigned_to) === uid
  const canWriteRow = (task) => {
    if (canEdit) return true
    if (task.parent_task_id == null) return false           // việc gốc: chỉ PM/admin
    if (Number(task.assigned_to) === uid) return true        // assignee của việc con
    const p = byId.get(String(task.parent_task_id))
    return !!(p && Number(p.assigned_to) === uid)            // assignee của việc cha
  }
  // Sắp xếp 1 việc trong nhóm anh-em: PM/admin (mọi việc) hoặc assignee của VIỆC CHA.
  const canReorderRow = (task) => {
    if (canEdit) return true
    if (task.parent_task_id == null) return false           // việc gốc: chỉ PM/admin
    const p = byId.get(String(task.parent_task_id))
    return !!(p && Number(p.assigned_to) === uid)
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openCreate()   { setEditTask(null); setParentTask(null); setModalOpen(true) }
  function openAddSub(t)  { setEditTask(null); setParentTask(t);    setModalOpen(true) }
  function openEdit(t)    { setEditTask(t);    setParentTask(null); setModalOpen(true) }
  // Lật theo hiện trạng (override nếu có, ngược lại theo mặc định thu của nhánh chuyển việc).
  function toggleTask(id) {
    setCollapsedTask(prev => {
      const cur = prev[id] ?? transferredIds.has(String(id))
      return { ...prev, [id]: !cur }
    })
  }

  async function handleSave(formData) {
    try {
      const url    = editTask ? `${API}/tasks/${editTask.id}` : `${API}/contracts/${contractId}/tasks`
      const method = editTask ? 'PUT' : 'POST'
      const body   = { ...formData, created_by: currentUser?.id }
      if (!editTask && parentTask) body.parent_task_id = parentTask.id
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      // Đổi trạng thái có thể: (a) mở khóa việc phụ thuộc; (b) tự hoàn thành/mở lại việc
      // cha theo cây con → tải lại để hiển thị trạng thái mới của toàn cây.
      load()
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  function toggleCollapse(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Menu chuột phải: sao chép thông tin việc để dán vào chat hỏi tình trạng ──────
  function openTaskCtxMenu(task, e) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, task })
  }
  function copyTaskInfo(task) {
    return copyToClipboard(buildTaskCopyText(task, contract))
  }

  // ── Chuyển việc: tạo việc con giống việc cha nhưng giao cho người được chọn ───────
  // Cùng quyền với "thêm việc con" (canAddSub): PM/admin hoặc người được giao việc này.
  async function handleTransfer({ department_id, assigned_to }) {
    const task = transferTask
    if (!task) return false
    try {
      const res = await fetch(`${API}/contracts/${contractId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         task.title,
          description:   task.description,
          department_id: department_id ?? task.department_id ?? null,
          assigned_to,
          created_by:    currentUser?.id,
          priority:      task.priority,
          // Giữ nguyên ràng buộc lịch của việc gốc (ngày cố định / bước trước / theo việc cha).
          start_date:    task.start_date ? task.start_date.slice(0, 10) : null,
          due_date:      task.due_date ? task.due_date.slice(0, 10) : null,
          duration_days: task.duration_days ?? null,
          dependencies:  Array.isArray(task.dependencies) ? task.dependencies : [],
          parent_start_offset: task.parent_start_offset ?? null,
          note:          task.note,
          // Để "Chờ xử lý" — backend tự chuyển sang "Đang thực hiện" nếu đã tới ngày bắt đầu.
          status:        'Chờ xử lý',
          parent_task_id: task.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi chuyển việc')
      setTasks(prev => [...prev, data])
      setCollapsedTask(prev => ({ ...prev, [task.id]: false }))  // mở việc cha để thấy việc con mới
      setTransferTask(null)
      return true
    } catch (e) {
      alert('Lỗi: ' + e.message)
      return false
    }
  }

  // Kéo-thả sắp xếp (Gantt "Không nhóm"): cập nhật lạc quan rồi lưu; lỗi → tải lại.
  async function handleReorder(orderedIds) {
    const idSet = new Set(orderedIds)
    setTasks(prev => {
      const moved = orderedIds.map(id => prev.find(t => t.id === id)).filter(Boolean)
      let k = 0
      return prev.map(t => (idSet.has(t.id) ? moved[k++] : t))
    })
    try {
      const res = await fetch(`${API}/contracts/${contractId}/tasks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      })
      if (!res.ok) throw new Error()
    } catch { load() }
  }

  if (loading) return <div className="task-loading">Đang tải...</div>

  // Modal dùng chung cho cả 2 chế độ. Ở chế độ Gantt nó render BÊN TRONG <TaskGantt>
  // (để khi mở toàn màn hình vẫn nằm trên & thao tác được); chế độ Danh sách render ở cuối.
  // Modal + menu chuột phải render cùng chỗ: ở Gantt nằm BÊN TRONG <TaskGantt> (để toàn
  // màn hình vẫn thao tác được), ở Danh sách render ở cuối tab.
  const overlayNodes = (
    <>
      {modalOpen && (
        <TaskModal
          task={editTask}
          parentTask={parentTask}
          departments={departments}
          users={users}
          allTasks={tasks}
          milestones={milestones}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={handleModalClose}
        />
      )}
      <TaskContextMenu
        key={ctxMenu ? `${ctxMenu.task.id}-${ctxMenu.x}-${ctxMenu.y}` : 'closed'}
        menu={ctxMenu}
        onCopy={copyTaskInfo}
        canTransfer={!!ctxMenu && canAddSub(ctxMenu.task)}
        onTransfer={(task) => setTransferTask(task)}
        onClose={() => setCtxMenu(null)}
      />
      {transferTask && (
        <TaskTransferDialog
          task={transferTask}
          departments={departments}
          users={users}
          currentUser={currentUser}
          onConfirm={handleTransfer}
          onClose={() => setTransferTask(null)}
        />
      )}
    </>
  )

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
          {view === 'list' && (
            <EditGuard>
              <button className="task-add-btn" onClick={openCreate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Thêm công việc
              </button>
            </EditGuard>
          )}
        </div>
      </div>

      {/* Bộ chọn nhóm (chỉ ở chế độ Danh sách) */}
      {view === 'list' && hasVisible && (
        <div className="task-group-toolbar">
          <span className="task-group-label">Nhóm theo:</span>
          <div className="task-group-seg">
            <button className={groupBy === 'department' ? 'active' : ''} onClick={() => setGroupBy('department')}>Phòng ban</button>
            <button className={groupBy === 'assignee' ? 'active' : ''} onClick={() => setGroupBy('assignee')}>Người được giao</button>
            <button className={groupBy === 'none' ? 'active' : ''} onClick={() => setGroupBy('none')}>Không nhóm</button>
          </div>
          {flat && canEdit && <span className="task-group-hint">Kéo công việc để đổi thứ tự</span>}
        </div>
      )}

      {/* Nội dung: Danh sách hoặc Gantt */}
      {view === 'gantt' ? (
        <TaskGantt
          tasks={tasks}
          visibleIds={visible}
          milestones={milestones}
          defaultCollapsedTaskIds={transferredIds}
          onEdit={openEdit}
          onAdd={canEdit ? openCreate : undefined}
          onAddSub={openAddSub}
          canAddSub={canAddSub}
          onReorder={handleReorder}
          canReorderRow={canReorderRow}
          onTaskContextMenu={openTaskCtxMenu}
        >
          {overlayNodes}
        </TaskGantt>
      ) : !hasVisible ? (
        <div className="task-empty">
          {filter === 'all'
            ? 'Chưa có công việc nào. Nhấn Thêm công việc để bắt đầu.'
            : 'Không có công việc nào khớp với bộ lọc.'}
        </div>
      ) : groups.map(group => (
        <DeptGroup
          key={group.key}
          group={group}
          flat={flat}
          childrenByParent={childrenByParent}
          visible={visible}
          collapsed={!!collapsed[group.key]}
          onToggle={() => toggleCollapse(group.key)}
          collapsedTask={effectiveCollapsedTask}
          onToggleTask={toggleTask}
          canWriteRow={canWriteRow}
          canAddSub={canAddSub}
          canReorderRow={canReorderRow}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onAddSub={openAddSub}
          onReorder={handleReorder}
          onTaskContextMenu={openTaskCtxMenu}
        />
      ))}

      {/* Modal + menu chuột phải (chế độ Danh sách) — Gantt render bên trong <TaskGantt> */}
      {view !== 'gantt' && overlayNodes}
    </div>
  )
}
