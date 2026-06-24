// Recursive folder-tree renderer for the documents tab left panel.
import EditGuard from './EditGuard'

export default function DocumentFolderTree({
  folders, selectedFolderId, expandedFolders,
  onSelect, onToggleExpand, onRename, onDelete,
  // Chế độ curate review (chỉ Đấu thầu): { busy, onToggleExclude }
  review,
}) {
  const renderNodes = (folderList, level = 0) => folderList.map(folder => (
    <div key={folder.id} className="folder-tree-item">
      <div
        className={`folder-node ${String(selectedFolderId) === String(folder.id) ? 'selected' : ''} ${folder.review_excluded ? 'review-excluded' : ''}`}
        style={{ paddingLeft: `${level * 16 + 6}px` }}
        onClick={() => onSelect(folder.id)}
      >
        <button
          className={`expand-btn ${folder.children?.length > 0 ? 'visible' : ''} ${expandedFolders.has(folder.id) ? 'expanded' : ''}`}
          onClick={(e) => onToggleExpand(folder.id, e)}
          disabled={!folder.children?.length}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l6 4-6 4V4z"/></svg>
        </button>
        <svg className="folder-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <span className="folder-name">{folder.folder_name}</span>
        {folder.review_excluded && <span className="review-tag review-tag--excluded">đã loại</span>}
        {review && (
          <button
            className="folder-action-btn"
            title={folder.review_excluded ? 'Khôi phục vào review' : 'Loại khỏi review'}
            disabled={review.busy}
            onClick={(e) => { e.stopPropagation(); review.onToggleExclude(folder) }}
          >
            {folder.review_excluded ? '↩' : '⊘'}
          </button>
        )}
        <EditGuard>
          <div className="folder-actions">
            <button className="folder-action-btn" title="Đổi tên" onClick={(e) => onRename(folder, e)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button className="folder-action-btn folder-action-delete" title="Xóa" onClick={(e) => onDelete(folder, e)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </EditGuard>
      </div>
      {folder.children?.length > 0 && expandedFolders.has(folder.id) && (
        <div className="folder-children">{renderNodes(folder.children, level + 1)}</div>
      )}
    </div>
  ))

  return <>{renderNodes(folders)}</>
}
