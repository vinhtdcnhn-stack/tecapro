import { useState, useEffect, useRef } from 'react'
import { API } from '../../config/api'
import { getFileIcon, formatFileSize, formatDate } from '../contracts/documentsUtils'
import TenderFilePreview from './TenderFilePreview'

// Tab "Tổng hợp hồ sơ": tải lên & xem trước bản hồ sơ tổng hợp của gói thầu
// (bản đơn giản; quản lý version đầy đủ để GĐ3).
export default function TenderSummaryTab({ tenderId, canEdit }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  function load() {
    setLoading(true)
    fetch(`${API}/tender/${tenderId}/summary`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setFiles(Array.isArray(d) ? d : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [tenderId])

  async function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API}/tender/${tenderId}/summary`, { method: 'POST', body: fd })
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
    if (!confirm('Xoá hồ sơ này?')) return
    const res = await fetch(`${API}/tender/summary/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Không thể xoá hồ sơ.')
  }

  return (
    <div className="tender-summary">
      <div className="tender-checklist-head">
        <p className="tender-muted" style={{ margin: 0 }}>Gom file từ các đầu việc, tải lên bản hồ sơ tổng hợp để trình review.</p>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" hidden onChange={onPick} />
            <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Đang tải…' : '+ Tải hồ sơ tổng hợp'}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="dash-empty">Đang tải…</p>
      ) : !files.length ? (
        <p className="dash-empty">Chưa có hồ sơ tổng hợp.</p>
      ) : (
        <ul className="tender-file-list">
          {files.map(f => {
            const ic = getFileIcon(f.mime_type)
            return (
              <li key={f.id} className="tender-file-item">
                <span style={{ color: ic.color }}>{ic.emoji}</span>
                <button className="tender-file-name" onClick={() => setPreview(f)} title="Xem trước">{f.file_name}</button>
                <span className="tender-muted">{formatFileSize(f.file_size)}</span>
                <span className="tender-muted">{f.uploaded_by_name || ''} · {formatDate(f.created_at)}</span>
                {canEdit && <button className="btn-link danger" onClick={() => remove(f.id)}>Xoá</button>}
              </li>
            )
          })}
        </ul>
      )}
      {preview && <TenderFilePreview file={preview} kind="summary" onClose={() => setPreview(null)} />}
    </div>
  )
}
