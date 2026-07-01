import { useState } from 'react'
import { formatFileSize, formatDate, getFileIcon } from './documentsUtils'
import { useRowLongPress } from './useLongPress'
import ContextMenu from '../common/ContextMenu'
import { auditRowAttrs } from '../common/rowAudit'

// File listing table for the currently-selected folder.

export default function DocumentFileTable({
  files, selectedFiles, previewFileId,
  onSelectAll, onFileClick, onToggleSelect,
  // Chế độ curate review (chỉ Đấu thầu): chuột phải / ấn giữ một dòng file để
  // đánh dấu Loại / Khôi phục, tải bản Thay thế, hoặc Gỡ thay thế.
  review,
}) {
  const [menu, setMenu] = useState(null)   // { x, y, title, file } | null

  // Dựng các mục menu chuột phải cho 1 file (chỉ ở chế độ review).
  const itemsFor = (file) => {
    if (file.replaces_file_id) {
      return [{ label: 'Gỡ thay thế', danger: true, disabled: review.busy, onClick: () => review.onDeleteReplacement(file) }]
    }
    return [
      { label: file.review_excluded ? 'Khôi phục vào bản review' : 'Loại khỏi bản review', disabled: review.busy, onClick: () => review.onToggleExclude(file) },
      { label: 'Thay thế bằng bản đã sửa…', disabled: review.busy, onClick: () => review.onUploadReplacement(file) },
    ]
  }

  const openMenu = (file, x, y) => setMenu({ x, y, title: file.file_name, file })
  const getLongPress = useRowLongPress((file, x, y) => review && openMenu(file, x, y))

  const reviewRowProps = (file) => review ? {
    onContextMenu: (e) => { e.preventDefault(); openMenu(file, e.clientX, e.clientY) },
    ...getLongPress(file),
  } : {}

  return (
    <>
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
            <td colSpan={5} className="empty-message">
              Thư mục này chưa có file nào. Kéo thả hoặc nhấn Upload để thêm.
            </td>
          </tr>
        ) : files.map(file => {
          const icon = getFileIcon(file.mime_type)
          const isSelected = selectedFiles.has(file.id)
          const isPreviewing = previewFileId === file.id
          const isReplacement = !!file.replaces_file_id
          return (
            <tr
              key={file.id}
              {...auditRowAttrs('document_file', file.id)}
              className={`${isSelected ? 'selected' : ''} ${isPreviewing ? 'previewing' : ''} ${file.review_excluded ? 'review-excluded' : ''} ${file.is_replaced ? 'is-replaced' : ''}`}
              onClick={(e) => onFileClick(file, e)}
              {...reviewRowProps(file)}
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
                  {isReplacement && (
                    <span className="review-tag review-tag--replace" title={`Thay thế cho: ${file.replaces_file_name || ''}`}>
                      ↻ thay thế{file.replaces_file_name ? ` cho “${file.replaces_file_name}”` : ''}
                    </span>
                  )}
                  {file.review_excluded && <span className="review-tag review-tag--excluded">đã loại</span>}
                  {file.is_replaced && <span className="review-tag review-tag--excluded" title="Đã có bản thay thế">đã thay thế</span>}
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
    {review && <ContextMenu menu={menu} items={menu ? itemsFor(menu.file) : []} onClose={() => setMenu(null)} />}
    </>
  )
}
