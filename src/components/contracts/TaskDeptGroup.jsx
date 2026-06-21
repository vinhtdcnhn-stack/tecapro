import { useState } from 'react'
import { API } from '../../config/api'
import { useLongPress } from './useLongPress'
import {
  STATUSES, fmtDate, daysUntil, isOverdue, isWarning,
  priorityClass, statusClass, initials, flattenTree, reorderIds,
} from './taskUtils'

// ── Department group (cây công việc con nhiều cấp) ──────────────────────────────

export default function DeptGroup({
  group, flat = false, childrenByParent, visible, collapsed, onToggle,
  collapsedTask, onToggleTask, canWriteRow, canAddSub, canReorderRow,
  onEdit, onDelete, onStatusChange, onAddSub, onReorder, onTaskContextMenu,
}) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  // Toàn bộ subtree (không tính thu/mở) để thống kê; danh sách hiển thị có tính thu/mở.
  const statTasks  = flattenTree(group.tasks, childrenByParent, { visible }).map(r => r.task)
  const renderRows = flattenTree(group.tasks, childrenByParent, { collapsed: collapsedTask, visible })

  const total    = statTasks.length
  const done     = statTasks.filter(t => t.status === 'Hoàn thành').length
  const inDoing  = statTasks.filter(t => t.status === 'Đang thực hiện').length
  const overdues = statTasks.filter(isOverdue).length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0

  const barColor = pct === 100 ? '#16a34a' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#e5e7eb'

  // Kéo-thả sắp xếp: chỉ trong cùng nhóm anh-em (cùng việc cha) và có quyền.
  function handleDrop(toId) {
    const dragTask = renderRows.find(r => r.task.id === dragId)?.task
    const dropTask = renderRows.find(r => r.task.id === toId)?.task
    setDragId(null); setOverId(null)
    if (!dragTask || !dropTask || dragId === toId) return
    const dp = dragTask.parent_task_id ?? null
    if (String(dp) !== String(dropTask.parent_task_id ?? null)) return
    if (!canReorderRow(dragTask)) return
    const sib = renderRows.filter(r => (r.task.parent_task_id ?? null) + '' === dp + '').map(r => r.task.id)
    const next = reorderIds(sib, dragId, toId)
    if (next.some((id, i) => id !== sib[i])) onReorder(next)
  }

  return (
    <div className={`task-dept-group ${flat ? 'task-flat' : ''} ${group.key === 'none' ? 'task-nodept' : ''}`}>
      {!flat && (
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
      )}

      {(flat || !collapsed) && (
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
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {renderRows.map(({ task, depth, hasChildren }, idx) => (
                <TaskRow
                  key={task.id}
                  idx={idx}
                  task={task}
                  depth={depth}
                  hasChildren={hasChildren}
                  collapsed={!!collapsedTask[task.id]}
                  onToggle={() => onToggleTask(task.id)}
                  canWrite={canWriteRow(task)}
                  canAddSub={canAddSub(task)}
                  canReorder={canReorderRow(task)}
                  dragging={dragId === task.id}
                  dragOver={overId === task.id && dragId != null && dragId !== task.id}
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== task.id) setOverId(task.id) }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(task.id) }}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                  onAddSub={() => onAddSub(task)}
                  onStatusChange={onStatusChange}
                  onContextMenu={(e) => onTaskContextMenu?.(task, e)}
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

function TaskRow({
  idx, task, depth, hasChildren, collapsed, onToggle, canWrite, canAddSub, onEdit, onDelete, onAddSub, onStatusChange,
  canReorder, dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDrop, onContextMenu,
}) {
  const overdue  = isOverdue(task)
  const warn     = isWarning(task)
  const days     = daysUntil(task.due_date)
  const locked   = (task.child_count || 0) > 0   // có việc con → trạng thái tự động
  // Mobile: ấn giữ để mở menu Sao chép (cùng hành vi với chuột phải trên desktop).
  const longPress = useLongPress((x, y) => onContextMenu?.({ preventDefault() {}, clientX: x, clientY: y }))

  const rowClass = [
    depth > 0 ? 'task-row--child' : '',
    overdue ? 'task-row--overdue' : '',
    warn    ? 'task-row--warning' : '',
    task.status === 'Hoàn thành' ? 'task-row--done' : '',
    dragging ? 'task-row--dragging' : '',
    dragOver ? 'task-row--dragover' : '',
  ].filter(Boolean).join(' ')

  return (
    <tr className={rowClass}
      onContextMenu={onContextMenu}
      {...longPress}
      onDragOver={canReorder ? onDragOver : undefined}
      onDrop={canReorder ? onDrop : undefined}>
      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
        {canReorder && (
          <span
            className="task-drag-grip"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            title="Kéo để đổi thứ tự"
            aria-hidden
          >⋮⋮</span>
        )}
        <span className="task-row-idx">{idx + 1}</span>
      </td>

      <td>
        <div className="task-title-cell" style={{ paddingLeft: depth * 20 }}>
          <div className="task-title-line">
            {hasChildren ? (
              <button className={`task-tree-toggle ${collapsed ? '' : 'open'}`} onClick={onToggle} title={collapsed ? 'Mở việc con' : 'Thu việc con'}>▶</button>
            ) : (
              <span className="task-tree-spacer" />
            )}
            <span className="task-title">{task.title}</span>
          </div>
          {task.description && <span className="task-desc-preview">{task.description}</span>}
          {Array.isArray(task.attachments) && task.attachments.map(att => {
            const isPdf = att.file_name.toLowerCase().endsWith('.pdf');
            return (
              <a
                key={att.id}
                href={`${API.replace('/api', '')}${att.file_path}`}
                target={isPdf ? '_blank' : undefined}
                rel="noreferrer"
                download={isPdf ? undefined : att.file_name}
                className="task-attach-badge task-attach-badge--link"
                title={att.file_name}
                onClick={e => e.stopPropagation()}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                <span className="task-attach-badge-name">{att.file_name}</span>
              </a>
            );
          })}
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
        {task.created_by_name && (
          <span className="assigner-line" title="Người giao việc">
            Giao bởi: {task.created_by_name}
          </span>
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
        {locked ? (
          <span
            className={`status-badge-task ${statusClass(task.status)} status-badge-task--locked`}
            title="Tự động theo việc con"
            style={{ fontWeight: 600, fontSize: 11, padding: '3px 8px' }}
          >
            {task.status} 🔒
          </span>
        ) : (
          <select
            value={task.status}
            onChange={e => onStatusChange(task, e.target.value)}
            disabled={!canWrite}
            className={`status-badge-task ${statusClass(task.status)}`}
            style={{ border: 'none', cursor: canWrite ? 'pointer' : 'default', background: 'transparent', fontWeight: 600, fontSize: 11, padding: '3px 8px' }}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </td>

      <td>
        <div className="task-actions">
          {canAddSub && (
            <button className="task-act-btn addsub" onClick={onAddSub} title="Thêm việc con">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
          )}
          {canWrite && (
            <>
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
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
