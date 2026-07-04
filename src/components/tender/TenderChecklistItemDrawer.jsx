import Modal from '../common/Modal'
import TenderChecklistTimeline from './TenderChecklistTimeline'
import { fmtDate } from './tenderUtils'
import '../contracts/ContractTaskTab.css'

// Màu trạng thái đầu việc (khớp TenderChecklistTab).
const STATUS_COLOR = {
  'Chờ xử lý':      { bg: '#f1f5f9', fg: '#475569' },
  'Đang thực hiện': { bg: '#fef9c3', fg: '#a16207' },
  'Hoàn thành':     { bg: '#dcfce7', fg: '#15803d' },
  'Hủy':            { bg: '#fee2e2', fg: '#b91c1c' },
}
const REVIEW_BADGE = {
  pending:  { label: 'Chờ duyệt', bg: '#fef9c3', fg: '#a16207' },
  approved: { label: 'Đã duyệt',  bg: '#dcfce7', fg: '#15803d' },
  returned: { label: 'Bị trả lại', bg: '#fee2e2', fg: '#b91c1c' },
}

// Drawer chi tiết ĐẦU VIỆC đấu thầu (phải; mobile full-screen qua CSS). Gồm thông tin
// tóm tắt + dòng thời gian trao đổi (báo cáo · chỉ đạo · trao đổi + ảnh). Tệp sản phẩm
// vẫn nằm ở hàng mở rộng (▸) trong tab Checklist; drawer này tập trung trao đổi tiến độ.
//   canManage = Trưởng phòng / người làm thầu của gói (canEdit của tab)
//   onEdit    = mở form sửa đầu việc (nếu truyền); ẩn khi đầu việc đã khoá
export default function TenderChecklistItemDrawer({ item, currentUser, canManage, onEdit, onClose, onChanged }) {
  if (!item) return null
  const sc = STATUS_COLOR[item.status] || STATUS_COLOR['Chờ xử lý']
  const rb = REVIEW_BADGE[item.review_status]

  return (
    <Modal onClose={onClose} overlayClassName="task-drawer-overlay" contentClassName="task-drawer-panel" labelledBy="tender-item-drawer-title">
      <div className="task-drawer-header">
        <h3 id="tender-item-drawer-title">{item.title || 'Chi tiết đầu việc'}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      <div className="task-drawer-body">
        <div className="task-detail-badges">
          <span className="task-detail-chip" style={{ background: sc.bg, color: sc.fg }}>{item.status}</span>
          {rb && <span className="task-detail-chip" style={{ background: rb.bg, color: rb.fg }}>{rb.label}</span>}
          {item.department_name && <span className="task-detail-chip">{item.department_name}</span>}
          {item.rework_count > 0 && <span className="task-detail-chip">🔁 Sửa lần {item.rework_count}</span>}
        </div>

        <dl className="task-detail-grid">
          <dt>Người phụ trách</dt><dd>{item.assignee_name || 'Chưa giao'}</dd>
          <dt>Người tạo</dt><dd>{item.created_by_name || '—'}</dd>
          <dt>Hạn hoàn thành</dt><dd>{item.due_date ? fmtDate(item.due_date) : '—'}</dd>
          {item.completed_at && <><dt>Hoàn thành</dt><dd>{fmtDate(item.completed_at)}</dd></>}
        </dl>

        {item.description && (
          <Section title="Mô tả"><p className="task-pre">{item.description}</p></Section>
        )}
        {item.rework_count > 0 && item.rework_reason && (
          <Section title={`Yêu cầu làm lại (lần ${item.rework_count})`}>
            <p className="task-pre">🔁 {item.rework_reason}</p>
          </Section>
        )}
        {item.review_status === 'returned' && item.review_comment && (
          <Section title="Trưởng ban trả lại">
            <p className="task-pre">↩ {item.review_comment}</p>
          </Section>
        )}

        <TenderChecklistTimeline
          itemId={item.id}
          item={item}
          currentUser={currentUser}
          canManage={canManage}
          onChanged={onChanged}
        />
      </div>

      <div className="task-drawer-footer">
        <button className="cancel-btn" onClick={onClose}>Đóng</button>
        {onEdit && (
          <button className="save-btn" onClick={() => onEdit(item)}>Sửa đầu việc</button>
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
