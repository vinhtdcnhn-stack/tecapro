import { useState, useEffect, useRef, useCallback } from 'react'
import { API } from '../../config/api'
import { getFileIcon, formatDate } from '../contracts/documentsUtils'
import TenderFilePreview from './TenderFilePreview'

// Tab "Review & Comment": trình hồ sơ theo phiên bản, Trưởng phòng kết luận Đạt/Chưa đạt,
// xem trước từng version + lịch sử comment.
export default function TenderReviewTab({ tenderId, canEdit, isHead }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [decision, setDecision] = useState({})   // { [versionId]: { conclusion, comment } }
  const inputRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/tender/${tenderId}/review`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setVersions(Array.isArray(d) ? d : []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [tenderId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [load])

  async function submit(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (note.trim()) fd.append('note', note.trim())
      const res = await fetch(`${API}/tender/${tenderId}/review/submit`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Trình hồ sơ thất bại.') }
      setNote('')
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function decide(versionId) {
    const d = decision[versionId] || {}
    if (!d.conclusion) { alert('Chọn kết luận Đạt / Chưa đạt.'); return }
    if (d.conclusion === 'fail' && !(d.comment || '').trim()) { alert('Cần ghi lý do khi Chưa đạt.'); return }
    const res = await fetch(`${API}/tender/review/${versionId}/decide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conclusion: d.conclusion, comment: d.comment || '' }),
    })
    if (res.ok) { setDecision(s => ({ ...s, [versionId]: {} })); load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'Không thể lưu kết luận.') }
  }

  const setDec = (vid, patch) => setDecision(s => ({ ...s, [vid]: { ...s[vid], ...patch } }))

  if (loading) return <p className="dash-empty">Đang tải…</p>

  const latestId = versions[0]?.id
  return (
    <div className="tender-review">
      {canEdit && (
        <div className="tender-review-submit">
          <input className="tender-review-note" placeholder="Ghi chú khi trình (vd: đã sửa theo góp ý)…"
            value={note} onChange={e => setNote(e.target.value)} />
          <input ref={inputRef} type="file" hidden onChange={submit} />
          <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={submitting}>
            {submitting ? 'Đang trình…' : '+ Trình hồ sơ review'}
          </button>
        </div>
      )}

      {!versions.length ? (
        <p className="dash-empty">Chưa có phiên bản hồ sơ nào được trình.</p>
      ) : (
        <div className="tender-version-list">
          {versions.map(v => {
            const ic = getFileIcon(v.mime_type)
            const passed = v.reviews.some(r => r.conclusion === 'pass')
            const decided = v.reviews.length > 0
            return (
              <div key={v.id} className="tender-version">
                <div className="tender-version-head">
                  <span className="tender-version-tag">v{v.version_no}</span>
                  <span style={{ color: ic.color }}>{ic.emoji}</span>
                  <button className="tender-file-name" onClick={() => setPreview(v)}>{v.file_name}</button>
                  <span className="tender-muted">{v.uploaded_by_name} · {formatDate(v.created_at)}</span>
                </div>
                {v.note && <p className="tender-version-note">📝 {v.note}</p>}

                {v.reviews.map(r => (
                  <div key={r.id} className={`tender-review-row ${r.conclusion}`}>
                    <span className="tender-badge" style={r.conclusion === 'pass'
                      ? { background: '#dcfce7', color: '#15803d' } : { background: '#fee2e2', color: '#b91c1c' }}>
                      {r.conclusion === 'pass' ? 'Đạt' : 'Chưa đạt'}
                    </span>
                    {r.comment && <span className="tender-review-comment">{r.comment}</span>}
                    <span className="tender-muted">{r.reviewer_name} · {formatDate(r.created_at)}</span>
                  </div>
                ))}

                {isHead && v.id === latestId && !passed && (
                  <div className="tender-decide">
                    <select value={(decision[v.id]?.conclusion) || ''}
                      onChange={e => setDec(v.id, { conclusion: e.target.value })}>
                      <option value="">— Kết luận —</option>
                      <option value="pass">Đạt</option>
                      <option value="fail">Chưa đạt</option>
                    </select>
                    <input className="tender-decide-comment" placeholder="Nhận xét / lý do…"
                      value={(decision[v.id]?.comment) || ''}
                      onChange={e => setDec(v.id, { comment: e.target.value })} />
                    <button className="btn-primary" onClick={() => decide(v.id)}>Lưu kết luận</button>
                  </div>
                )}
                {decided && passed && <p className="tender-version-done">✓ Hồ sơ đã đạt — sẵn sàng in/ký.</p>}
              </div>
            )
          })}
        </div>
      )}
      {preview && <TenderFilePreview file={preview} kind="version" onClose={() => setPreview(null)} />}
    </div>
  )
}
