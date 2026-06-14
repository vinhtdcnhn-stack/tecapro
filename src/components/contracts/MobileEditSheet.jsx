import Modal from '../common/Modal'
import './MobileEditSheet.css'

// Bottom-sheet sửa 1 bản ghi trên mobile. Tái dùng cho mọi tab: truyền tiêu đề,
// nội dung form (các Field xếp dọc) và các handler lưu/xóa/đóng sẵn có của tab.
export default function MobileEditSheet({
  title, onClose, onSave, onDelete, saving, saveLabel = 'Lưu', children,
}) {
  return (
    <Modal
      onClose={onClose}
      overlayClassName="msheet-overlay"
      contentClassName="msheet-panel"
      labelledBy="msheet-title"
    >
        <div className="msheet-header">
          <span className="msheet-title" id="msheet-title">{title}</span>
          <button className="msheet-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="msheet-body">{children}</div>
        <div className="msheet-footer">
          {onDelete && (
            <button className="msheet-btn msheet-btn-danger" onClick={onDelete}>Xóa</button>
          )}
          <div className="msheet-spacer" />
          <button className="msheet-btn msheet-btn-secondary" onClick={onClose}>Đóng</button>
          {onSave && (
            <button className="msheet-btn msheet-btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Đang lưu…' : saveLabel}
            </button>
          )}
        </div>
    </Modal>
  )
}

// 1 trường trong sheet: nhãn ở trên, control (input/select/DateInput) ở dưới, full width.
// className tùy chọn để chỗ gọi mở rộng bố cục (vd span full-width trong lưới desktop).
export function Field({ label, children, className = '' }) {
  return (
    <label className={`msheet-field ${className}`.trim()}>
      <span className="msheet-field-label">{label}</span>
      {children}
    </label>
  )
}
