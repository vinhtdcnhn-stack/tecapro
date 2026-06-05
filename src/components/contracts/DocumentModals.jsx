import { flattenFolders } from './documentsUtils'

// Folder create / rename / delete modals for the documents tab.

export function NewFolderModal({ name, setName, parentId, setParentId, folders, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Tạo thư mục mới</h3>
        <div className="form-group">
          <label>Tên thư mục</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên thư mục..." autoFocus onKeyDown={(e) => e.key === 'Enter' && onConfirm()} />
        </div>
        <div className="form-group">
          <label>Thư mục cha</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">-- Thư mục gốc --</option>
            {flattenFolders(folders).map(f => (
              <option key={f.id} value={f.id}>{'　'.repeat(f.level)}{f.folder_name}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Hủy</button>
          <button className="btn-confirm" onClick={onConfirm}>Tạo</button>
        </div>
      </div>
    </div>
  )
}

export function RenameFolderModal({ value, setValue, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Đổi tên thư mục</h3>
        <div className="form-group">
          <label>Tên mới</label>
          <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
            autoFocus onKeyDown={(e) => e.key === 'Enter' && onConfirm()} />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Hủy</button>
          <button className="btn-confirm" onClick={onConfirm}>Lưu</button>
        </div>
      </div>
    </div>
  )
}

export function DeleteFolderModal({ folder, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Xóa thư mục</h3>
        <p className="confirm-message">
          Bạn có chắc muốn xóa thư mục <strong>"{folder?.folder_name}"</strong>?<br />
          Tất cả thư mục con và file bên trong cũng sẽ bị xóa.
        </p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Hủy</button>
          <button className="btn-confirm btn-danger" onClick={onConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  )
}
