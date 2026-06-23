import { useState, useEffect, useRef } from 'react'
import { API } from '../../config/api'
import { getFileIcon } from '../contracts/documentsUtils'
import Modal from '../common/Modal'
import DocumentPreviewPanel from '../contracts/DocumentPreviewPanel'

// Danh sách tệp sản phẩm của một đầu việc (phía Ban Đấu thầu, trong tab Checklist).
// Dùng chung kho document_file(item_id) với trang "Việc đấu thầu của tôi": hiển thị
// PHẲNG mọi tệp của đầu việc (kèm tên thư mục), tải lên vào gốc, xoá, xem trước.
// Quản lý thư mục đầy đủ nằm ở trang chi tiết việc; ở đây giữ gọn để review nhanh.
export default function ChecklistItemAttachments({ itemId, canContribute }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  function load() {
    fetch(`${API}/tender/checklist/${itemId}/docs/files?flat=1`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setFiles(Array.isArray(d) ? d : []))
      .catch(() => setFiles([]))
  }
  useEffect(load, [itemId])

  async function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folderId', 'root')
      const res = await fetch(`${API}/tender/checklist/${itemId}/docs/files/upload`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Tải lên thất bại.') }
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(id) {
    if (!confirm('Xoá tệp này?')) return
    const res = await fetch(`${API}/files/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Không thể xoá tệp.')
  }

  return (
    <div className="tender-attachments">
      <div className="tender-attachments-head">
        <span className="tender-attachments-title">Tệp sản phẩm</span>
        {canContribute && (
          <>
            <input ref={inputRef} type="file" hidden onChange={onPick} />
            <button className="btn-link" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Đang tải…' : '+ Tải tệp'}
            </button>
          </>
        )}
      </div>
      {!files.length ? (
        <p className="tender-muted" style={{ fontSize: 13 }}>Chưa có tệp.</p>
      ) : (
        <ul className="tender-file-list">
          {files.map(f => {
            const ic = getFileIcon(f.mime_type)
            return (
              <li key={f.id} className="tender-file-item">
                <span style={{ color: ic.color }}>{ic.emoji}</span>
                <button className="tender-file-name" onClick={() => setPreview(f)} title="Xem trước">{f.file_name}</button>
                {f.folder_name && <span className="tender-muted">📁 {f.folder_name}</span>}
                <span className="tender-muted">{f.uploaded_by_name || ''}</span>
                {canContribute && <button className="btn-link danger" onClick={() => remove(f.id)}>Xoá</button>}
              </li>
            )
          })}
        </ul>
      )}
      {preview && (
        <Modal onClose={() => setPreview(null)} width={900} className="tender-preview-modal">
          <div className="modal-header">
            <h3>Xem trước tài liệu</h3>
            <button className="modal-close" onClick={() => setPreview(null)}>✕</button>
          </div>
          <div className="modal-body" style={{ padding: 0, height: '70vh' }}>
            <DocumentPreviewPanel file={preview} />
          </div>
        </Modal>
      )}
    </div>
  )
}
