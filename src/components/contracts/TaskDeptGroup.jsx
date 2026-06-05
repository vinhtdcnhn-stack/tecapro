import { API } from '../../config/api'
import {
  STATUSES, fmtDate, daysUntil, isOverdue, isWarning,
  priorityClass, statusClass, initials,
} from './taskUtils'

// ── Department group ──────────────────────────────────────────────────────────

export default function DeptGroup({ group, collapsed, onToggle, onEdit, onDelete, onStatusChange }) {
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

function TaskRow({ idx, task, onEdit, onDelete, onStatusChange }) {
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
