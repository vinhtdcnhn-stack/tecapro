import { formatFileSize, formatDate, getFileIcon } from './documentsUtils'

// File listing table for the currently-selected folder.

export default function DocumentFileTable({
  files, selectedFiles, previewFileId,
  onSelectAll, onFileClick, onToggleSelect,
}) {
  return (
    <table className="documents-table">
      <thead>
        <tr>
          <th className="col-select">
            <input
              type="checkbox"
              checked={files.length > 0 && selectedFiles.size === files.length}
              onChange={onSelectAll}
              title="Chọn tất cả"
            />
          </th>
          <th className="col-name">Tên file</th>
          <th className="col-size">Kích thước</th>
          <th className="col-date">Ngày tải</th>
          <th className="col-uploader">Người tải</th>
        </tr>
      </thead>
      <tbody>
        {files.length === 0 ? (
          <tr>
            <td colSpan="5" className="empty-message">
              Thư mục này chưa có file nào. Kéo thả hoặc nhấn Upload để thêm.
            </td>
          </tr>
        ) : files.map(file => {
          const icon = getFileIcon(file.mime_type)
          const isSelected = selectedFiles.has(file.id)
          const isPreviewing = previewFileId === file.id
          return (
            <tr
              key={file.id}
              className={`${isSelected ? 'selected' : ''} ${isPreviewing ? 'previewing' : ''}`}
              onClick={(e) => onFileClick(file, e)}
            >
              <td className="col-select">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(file, isSelected) }}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="col-name">
                <div className="file-info">
                  <span className="file-icon" style={{ color: icon.color }}>{icon.emoji}</span>
                  <span className="file-name-text" title={file.file_name}>{file.file_name}</span>
                </div>
              </td>
              <td className="col-size">{formatFileSize(file.file_size)}</td>
              <td className="col-date">{formatDate(file.uploaded_at)}</td>
              <td className="col-uploader">{file.uploaded_by_name || '-'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
