import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import './ContractTaskTab.css'

import { API } from '../../config/api'
import { qk } from '../../lib/queries'
import { isOverdue, groupByDept, groupByAssignee, buildTaskTree, visibleTaskIds, buildTaskCopyText, copyToClipboard, transferredParentIds } from './taskUtils'
import { useCanEdit } from '../../context/ContractPermContext'
import DeptGroup from './TaskDeptGroup'
import TaskModal from './TaskModal'
import TaskGantt from './TaskGantt'
import TaskContextMenu from './TaskContextMenu'
import TaskTransferDialog from './TaskTransferDialog'
import TaskRejectDialog from './TaskRejectDialog'
import ContractTaskDetailDrawer from './ContractTaskDetailDrawer'
import EditGuard from './EditGuard'
import { useTaskCompletion } from './useTaskCompletion'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractTaskTab({ contractId, currentUser, contract = null, initialTaskId = null }) {
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
  const [detailTaskId, setDetailTaskId] = useState(null)  // ≠ null = đang mở khung chi tiết việc
  const [highlightId, setHighlightId] = useState(null)  // id việc cần làm nổi bật khi đến từ đường dẫn
  const jumpedFor = useRef(null)  // id đã nhảy tới (tránh nhảy lặp lại mỗi lần render)
  const canEdit = useCanEdit()
  const queryClient = useQueryClient()

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
    finally {
      setLoading(false)
      // Đồng bộ cảnh báo nền đỏ toàn trang (đọc xong → xóa cảnh báo ngay).
      window.dispatchEvent(new Event('contracttask:refresh-unread'))
    }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // ── Đến từ đường dẫn đã sao chép: nhảy tới & làm nổi bật đúng công việc ─────────
  // Mở các việc cha (kể cả nhánh "chuyển việc" mặc định thu), bỏ lọc, về chế độ Danh
  // sách, rồi cuộn tới dòng việc. jumpedFor tránh nhảy lặp; đổi taskId → nhảy lại.
  useEffect(() => {
    if (!initialTaskId || loading || !tasks.length) return
    if (jumpedFor.current === String(initialTaskId)) return
    const target = tasks.find(t => String(t.id) === String(initialTaskId))
    if (!target) return
    jumpedFor.current = String(initialTaskId)

    // Mở toàn bộ chuỗi việc cha để dòng việc hiển thị.
    const taskById = new Map(tasks.map(t => [String(t.id), t]))
    const openAncestors = {}
    const seen = new Set()
    let cur = target
    while (cur?.parent_task_id != null && !seen.has(String(cur.id))) {
      seen.add(String(cur.id))
      openAncestors[String(cur.parent_task_id)] = false
      cur = taskById.get(String(cur.parent_task_id))
    }
    /* eslint-disable react-hooks/set-state-in-effect -- áp trạng thái điều hướng một lần khi đến từ đường dẫn */
    setCollapsedTask(prev => ({ ...prev, ...openAncestors }))
    setFilter('all')
    setView('list')
    setHighlightId(String(target.id))
    setDetailTaskId(target.id)  // mở luôn khung chi tiết việc khi đến từ đường dẫn
    /* eslint-enable react-hooks/set-state-in-effect */

    // Cuộn sau khi cây đã render lại (đợi mở nhánh + đổi chế độ).
    const timer = setTimeout(() => {
      document.getElementById(`task-row-${target.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(timer)
  }, [initialTaskId, loading, tasks])

  // Tự tắt làm nổi bật sau vài giây.
  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 3500)
    return () => clearTimeout(t)
  }, [highlightId])

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
  // Chuyển việc (đổi người thực hiện): khớp backend canTransferTask — PM/admin, người
  // được giao, hoặc người tạo việc.
  const canTransferRow = (task) => canEdit || Number(task.assigned_to) === uid || Number(task.created_by) === uid
  const canWriteRow = (task) => {
    if (canEdit) return true
    if (task.parent_task_id == null) return false           // việc gốc: chỉ PM/admin
    if (Number(task.assigned_to) === uid) return true        // assignee của việc con
    const p = byId.get(String(task.parent_task_id))
    return !!(p && Number(p.assigned_to) === uid)            // assignee của việc cha
  }
  // Đổi TRẠNG THÁI rộng hơn sửa việc (khớp backend canChangeTaskStatus): người được giao
  // tự cập nhật được việc của mình, kể cả việc gốc.
  const canChangeStatusRow = (task) => {
    if (canWriteRow(task)) return true
    return Number(task.assigned_to) === uid || Number(task.created_by) === uid
  }
  // Xác nhận / trả lại kết quả: người GIAO việc, PM của HĐ, admin (khớp canConfirmTaskCompletion).
  const canConfirmRow = (task) => canEdit || Number(task.created_by) === uid
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
  function openDetail(t)  { setDetailTaskId(t.id) }

  // Mở khung chi tiết → dòng thời gian tự ghi mốc đã đọc ở server. Xóa nền hổ phách dòng
  // việc NGAY tại chỗ (danh sách + Gantt cùng đọc từ `tasks`) thay vì chờ tải lại cả tab,
  // và ép cảnh báo nền đỏ toàn trang poll lại để badge khớp.
  const handleTaskRead = useCallback((taskId) => {
    setTasks(prev => prev.map(t =>
      (String(t.id) === String(taskId) && t.unread_count) ? { ...t, unread_count: 0 } : t))
    window.dispatchEvent(new Event('contracttask:refresh-unread'))
  }, [])
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

  // Đổi trạng thái + xác nhận/trả lại kết quả (endpoint riêng, xem useTaskCompletion).
  const {
    rejectTask, setRejectTask, changeStatus: handleStatusChange,
    confirmCompletion: handleConfirmDone, rejectCompletion: handleRejectDone,
  } = useTaskCompletion({
    onChanged: (data) => setTasks(prev => prev.map(t => t.id === data.id ? data : t)),
    reload: load,
  })

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

  // ── Chuyển việc: chỉ đổi NGƯỜI THỰC HIỆN của chính việc này (không tạo việc con) ───
  // Quyền: PM/admin, người tạo, hoặc người đang được giao (gác ở backend canTransferTask).
  async function handleTransfer({ department_id, assigned_to, note }) {
    const task = transferTask
    if (!task) return false
    try {
      const res = await fetch(`${API}/tasks/${task.id}/transfer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to, department_id: department_id ?? null, note }),
      })
      const { added_to_technical: addedTech, ...updated } = await res.json()
      if (!res.ok) throw new Error(updated.error || 'Lỗi chuyển việc')
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      setTransferTask(null)
      // Trưởng/Phó ban KT chuyển việc → backend tự thêm người nhận vào danh sách Kỹ
      // thuật của HĐ; nạp lại thông tin HĐ để tab Thông tin hiện đúng thành viên.
      if (addedTech) queryClient.invalidateQueries({ queryKey: qk.contract(contractId) })
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

  // Việc đang mở khung chi tiết — tra từ state để luôn đồng bộ sau mỗi lần load().
  const detailTask = detailTaskId != null ? tasks.find(t => String(t.id) === String(detailTaskId)) || null : null

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
        canTransfer={!!ctxMenu && canTransferRow(ctxMenu.task)}
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
      {rejectTask && (
        <TaskRejectDialog
          task={rejectTask}
          onConfirm={handleRejectDone}
          onClose={() => setRejectTask(null)}
        />
      )}
      {detailTask && (
        <ContractTaskDetailDrawer
          task={detailTask}
          currentUser={currentUser}
          canManage={canEdit}
          canWrite={canWriteRow(detailTask)}
          canConfirm={canConfirmRow(detailTask)}
          onConfirmDone={handleConfirmDone}
          onRejectDone={setRejectTask}
          onEdit={(t) => { setDetailTaskId(null); openEdit(t) }}
          onClose={() => setDetailTaskId(null)}
          onChanged={load}
          onRead={handleTaskRead}
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
          onOpenDetail={openDetail}
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
          highlightId={highlightId}
          canWriteRow={canWriteRow}
          canStatusRow={canChangeStatusRow}
          canConfirmRow={canConfirmRow}
          canAddSub={canAddSub}
          canReorderRow={canReorderRow}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onConfirmDone={handleConfirmDone}
          onRejectDone={setRejectTask}
          onAddSub={openAddSub}
          onReorder={handleReorder}
          onTaskContextMenu={openTaskCtxMenu}
          onOpenDetail={openDetail}
        />
      ))}

      {/* Modal + menu chuột phải (chế độ Danh sách) — Gantt render bên trong <TaskGantt> */}
      {view !== 'gantt' && overlayNodes}
    </div>
  )
}
