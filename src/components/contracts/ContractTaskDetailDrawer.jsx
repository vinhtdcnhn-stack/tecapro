import './ContractTaskDetail.css'
import Modal from '../common/Modal'
import ContractTaskTimeline from './ContractTaskTimeline'
import Linkify from '../common/Linkify'
import { API } from '../../config/api'
import { fmtDate } from './taskUtils'
import { auditRowAttrs } from '../common/rowAudit'

// Đường dẫn tải tệp đính kèm (file_path lưu tương đối từ gốc, vd /uploads/...).
const fileHref = (p) => `${API.replace('/api', '')}${p}`

// Khung chi tiết việc HĐ (drawer phải; mobile full-screen qua CSS). Nhận task object
// truyền thẳng từ state của tab (danh sách đã có đủ field + attachments). Gồm thông tin,
// đính kèm, dòng thời gian trao đổi và nút "Sửa công việc".
//   canManage  = PM/admin của HĐ (quyết định loại mục được đăng ở dòng thời gian)
//   canWrite   = quyền sửa dòng việc này (hiện nút "Sửa công việc")
//   canConfirm = quyền xác nhận kết quả (người giao việc / PM / admin)
export default function ContractTaskDetailDrawer({
  task, currentUser, canManage, canWrite, canConfirm,
  onConfirmDone, onRejectDone, onEdit, onClose, onChanged, onRead,
}) {
  if (!task) return null

  const atts = Array.isArray(task.attachments) ? task.attachments : []
  const rejectCount = Number(task.completion_reject_count) || 0

  return (
    <Modal onClose={onClose} overlayClassName="task-drawer-overlay" contentClassName="task-drawer-panel" labelledBy="task-drawer-title">
      <div className="task-drawer-header">
        <h3 id="task-drawer-title">{task.title || 'Chi tiết công việc'}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      <div className="task-drawer-body">
        <dl className="task-detail-grid">
          <dt>Người thực hiện</dt><dd>{task.assigned_to_name || 'Chưa assign'}</dd>
          <dt>Người giao</dt><dd>{task.created_by_name || '—'}</dd>
          <dt>Hạn hoàn thành</dt><dd>{fmtDate(task.due_date)}</dd>
        </dl>

        {/* Đã báo hoàn thành, chờ người giao việc chốt */}
        {task.completion_pending && (
          <div className="task-await-panel">
            <div className="task-await-panel-text">
              ⏳ <strong>{task.completion_requested_by_name || 'Người thực hiện'}</strong> đã báo hoàn thành
              {task.completion_requested_at ? ` lúc ${new Date(task.completion_requested_at).toLocaleString('vi-VN')}` : ''}.
              {canConfirm
                ? ' Bạn hãy kiểm tra rồi xác nhận, hoặc trả lại kèm lý do.'
                : ' Đang chờ người giao việc xác nhận.'}
            </div>
            {canConfirm && (
              <div className="task-await-panel-actions">
                <button type="button" className="task-await-panel-btn ok" onClick={() => onConfirmDone?.(task)}>
                  ✔ Xác nhận hoàn thành
                </button>
                <button type="button" className="task-await-panel-btn no" onClick={() => { onClose?.(); onRejectDone?.(task) }}>
                  ✘ Chưa đạt
                </button>
              </div>
            )}
          </div>
        )}
        {/* Lý do bị trả lại gần nhất (khi việc đang làm lại) */}
        {!task.completion_pending && rejectCount > 0 && task.completion_reject_reason && (
          <div className="task-reject-note">
            ❌ Bị trả lại {rejectCount} lần. Lý do gần nhất: <strong>{task.completion_reject_reason}</strong>
          </div>
        )}

        {task.description && (
          <Section title="Mô tả"><p className="task-pre"><Linkify text={task.description} onNavigate={onClose} /></p></Section>
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
