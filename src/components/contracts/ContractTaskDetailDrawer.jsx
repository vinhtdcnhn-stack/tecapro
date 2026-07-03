import Modal from '../common/Modal'
import ContractTaskTimeline from './ContractTaskTimeline'
import Linkify from '../common/Linkify'
import { API } from '../../config/api'
import { fmtDate, statusClass, priorityClass } from './taskUtils'
import { auditRowAttrs } from '../common/rowAudit'

// Đường dẫn tải tệp đính kèm (file_path lưu tương đối từ gốc, vd /uploads/...).
const fileHref = (p) => `${API.replace('/api', '')}${p}`

// Khung chi tiết việc HĐ (drawer phải; mobile full-screen qua CSS). Nhận task object
// truyền thẳng từ state của tab (danh sách đã có đủ field + attachments). Gồm thông tin,
// đính kèm, dòng thời gian trao đổi và nút "Sửa công việc".
//   canManage = PM/admin của HĐ (quyết định loại mục được đăng ở dòng thời gian)
//   canWrite  = quyền sửa dòng việc này (hiện nút "Sửa công việc")
export default function ContractTaskDetailDrawer({
  task, currentUser, canManage, canWrite, onEdit, onClose, onChanged, onRead,
}) {
  if (!task) return null

  const atts = Array.isArray(task.attachments) ? task.attachments : []

  return (
    <Modal onClose={onClose} overlayClassName="task-drawer-overlay" contentClassName="task-drawer-panel" labelledBy="task-drawer-title">
      <div className="task-drawer-header">
        <h3 id="task-drawer-title">{task.title || 'Chi tiết công việc'}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      <div className="task-drawer-body">
        <div className="task-detail-badges">
          <span className={`status-badge-task ${statusClass(task.status)}`}>{task.status}</span>
          <span className={`priority-badge ${priorityClass(task.priority)}`}>{task.priority}</span>
          {task.department_name && <span className="task-detail-chip">{task.department_name}</span>}
        </div>

        <dl className="task-detail-grid">
          <dt>Người thực hiện</dt><dd>{task.assigned_to_name || 'Chưa assign'}</dd>
          <dt>Người giao</dt><dd>{task.created_by_name || '—'}</dd>
          <dt>Bắt đầu</dt><dd>{task.start_date ? fmtDate(task.start_date) : '—'}</dd>
          <dt>Hạn hoàn thành</dt><dd>{fmtDate(task.due_date)}</dd>
          {task.completed_at && <><dt>Hoàn thành</dt><dd>{fmtDate(task.completed_at)}</dd></>}
        </dl>

        {task.description && (
          <Section title="Mô tả"><p className="task-pre"><Linkify text={task.description} onNavigate={onClose} /></p></Section>
        )}
        {task.note && (
          <Section title="Ghi chú"><p className="task-pre"><Linkify text={task.note} onNavigate={onClose} /></p></Section>
        )}

        <Section title={`Tài liệu đính kèm (${atts.length})`}>
          <div className="task-detail-att-list">
            {atts.map(att => {
              const isPdf = att.file_name.toLowerCase().endsWith('.pdf')
              return (
                <a
                  key={att.id}
                  {...auditRowAttrs('contract_task_attachment', att.id)}
                  href={fileHref(att.file_path)}
                  target={isPdf ? '_blank' : undefined}
                  rel="noreferrer"
                  download={isPdf ? undefined : att.file_name}
                  className="task-detail-att-name"
                  title={att.file_name}
                >
                  📎 {att.file_name}
                </a>
              )
            })}
            {atts.length === 0 && <p className="task-detail-empty">Chưa có tài liệu.</p>}
          </div>
        </Section>

        <ContractTaskTimeline
          taskId={task.id}
          task={task}
          currentUser={currentUser}
          canManage={canManage}
          onChanged={onChanged}
          onRead={onRead}
        />
      </div>

      <div className="task-drawer-footer">
        <button className="cancel-btn" onClick={onClose}>Đóng</button>
        {canWrite && (
          <button className="save-btn" onClick={() => onEdit(task)}>Sửa công việc</button>
        )}
      </div>
    </Modal>
  )
}

function Section({ title, children }) {
  return (
    <div className="task-detail-section">
      <h4 className="task-detail-title">{title}</h4>
      {children}
    </div>
  )
}
