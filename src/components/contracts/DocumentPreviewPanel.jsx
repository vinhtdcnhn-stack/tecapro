import { API } from '../../config/api'
import { getFileIcon } from './documentsUtils'

// PDF / image preview panel for the documents tab.

export default function DocumentPreviewPanel({ file, onClose }) {
  const icon = getFileIcon(file.mime_type)
  return (
    <div className="documents-preview-panel">
      <div className="preview-header">
        <div className="preview-title-area">
          <span style={{ color: icon.color, fontSize: 16 }}>{icon.emoji}</span>
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
          <button className="btn-close-preview" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
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
    </div>
  )
}
