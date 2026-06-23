import Modal from '../common/Modal'
import DocumentPreviewPanel from '../contracts/DocumentPreviewPanel'
import { API } from '../../config/api'

// Modal xem trước tệp Đấu thầu (PDF iframe / DOCX qua Mammoth / ảnh), dùng lại
// DocumentPreviewPanel với endpoint phục vụ tệp của module.
//   kind: 'attachment' | 'summary' | 'invitation' | 'version'
export default function TenderFilePreview({ file, kind, onClose }) {
  if (!file) return null
  const base = `${API}/tender-files/${kind}/${file.id}`
  return (
    <Modal onClose={onClose} width={900} className="tender-preview-modal">
      <div className="modal-header">
        <h3>Xem trước tài liệu</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body" style={{ padding: 0, height: '70vh' }}>
        <DocumentPreviewPanel file={file} viewUrl={`${base}/view`} downloadUrl={`${base}/download`} />
      </div>
    </Modal>
  )
}
