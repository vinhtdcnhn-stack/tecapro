import { API } from '../../config/api'
import { getFileIcon } from './documentsUtils'

export default function DocumentPreviewPanel({ file }) {
  return (
    <div className="documents-preview-panel">
      {file ? (
        <>
          <div className="preview-header">
            <div className="preview-title-area">
              <span style={{ color: getFileIcon(file.mime_type).color, fontSize: 16 }}>{getFileIcon(file.mime_type).emoji}</span>
              <span className="preview-title">{file.file_name}</span>
            </div>
            <div className="preview-header-actions">
              <button
                className="btn-toolbar"
                style={{ padding: '5px 11px', fontSize: 12 }}
                onClick={() => window.open(`${API}/files/${file.id}/download`, '_blank')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download
              </button>
            </div>
          </div>
          <div className="preview-content">
            {file.mime_type?.includes('pdf') ? (
              <iframe src={`${API}/files/${file.id}/view`} className="pdf-preview" title={file.file_name} />
            ) : (
              <img src={`${API}/files/${file.id}/view`} alt={file.file_name} className="image-preview" />
            )}
          </div>
        </>
      ) : (
        <div className="preview-content">
          <div className="preview-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <p>Chọn file để xem trước</p>
          </div>
        </div>
      )}
    </div>
  )
}
