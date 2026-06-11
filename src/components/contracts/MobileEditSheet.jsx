import './MobileEditSheet.css'

// Bottom-sheet sửa 1 bản ghi trên mobile. Tái dùng cho mọi tab: truyền tiêu đề,
// nội dung form (các Field xếp dọc) và các handler lưu/xóa/đóng sẵn có của tab.
export default function MobileEditSheet({
  title, onClose, onSave, onDelete, saving, saveLabel = 'Lưu', children,
}) {
  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet-panel" onClick={e => e.stopPropagation()}>
        <div className="msheet-header">
          <span className="msheet-title">{title}</span>
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
      </div>
    </div>
  )
}

// 1 trường trong sheet: nhãn ở trên, control (input/select/DateInput) ở dưới, full width.
export function Field({ label, children }) {
  return (
    <label className="msheet-field">
      <span className="msheet-field-label">{label}</span>
      {children}
    </label>
  )
}
