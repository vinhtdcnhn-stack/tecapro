import { useState, useEffect, useCallback } from 'react'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import useIsMobile from '../contracts/useIsMobile'
import { API } from '../../config/api'
import { fmtDate } from './deptWorkUtils'

// Danh sách + thêm báo cáo vấn đề cho một việc.
// canReport: người đang được giao việc (báo vấn đề). canResolve: head/deputy (đánh dấu xử lý).
export default function IssuePanel({ taskId, canReport, canResolve, onChanged }) {
  const isMobile = useIsMobile()
  const [issues, setIssues] = useState([])
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/dept-work/tasks/${taskId}/issues`)
      setIssues(r.ok ? await r.json() : [])
    } catch (e) { console.error('load issues:', e) }
  }, [taskId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  async function submit() {
    const text = content.trim()
    if (!text) { alert('Vui lòng nhập nội dung vấn đề.'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/dept-work/tasks/${taskId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Gửi thất bại'); return }
      setContent(''); setAdding(false)
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
    finally { setSaving(false) }
  }

  async function resolve(id) {
    if (!confirm('Đánh dấu vấn đề này đã xử lý?')) return
    try {
      const res = await fetch(`${API}/dept-work/issues/${id}/resolve`, { method: 'PUT' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Cập nhật thất bại'); return }
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
  }

  const openCount = issues.filter(i => i.status === 'open').length

  return (
    <div className="dw-detail-section">
      <h4 className="dw-detail-title">
        Vấn đề ({issues.length}{openCount ? ` · ${openCount} đang mở` : ''})
      </h4>

      <div className="dw-issue-list">
        {issues.map(i => (
          <div key={i.id} className={`dw-issue-item${i.status === 'resolved' ? ' dw-issue-done' : ''}`}>
            <p className="dw-pre dw-issue-content">{i.content}</p>
            <div className="dw-issue-meta">
              <span>{i.reported_by_name || '—'} · {fmtDate(i.created_at)}</span>
              {i.status === 'resolved'
                ? <span className="dw-issue-tag-done">✓ Đã xử lý{i.resolved_by_name ? ` · ${i.resolved_by_name}` : ''}</span>
                : <span className="dw-issue-tag-open">Đang mở</span>}
              {i.status === 'open' && canResolve && (
                <button className="dw-act-btn dw-issue-resolve" onClick={() => resolve(i.id)}>✓ Đã xử lý</button>
              )}
            </div>
          </div>
        ))}
        {issues.length === 0 && <p className="dash-empty">Chưa có vấn đề nào.</p>}
      </div>

      {canReport && !isMobile && (
        adding ? (
          <div className="dw-issue-add">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Mô tả vướng mắc khi triển khai..."
              autoFocus
            />
            <div className="dw-issue-add-actions">
              <button className="cancel-btn" onClick={() => { setAdding(false); setContent('') }}>Hủy</button>
              <button className="save-btn" onClick={submit} disabled={saving}>{saving ? 'Đang gửi…' : 'Gửi'}</button>
            </div>
          </div>
        ) : (
          <button className="dw-att-add" onClick={() => setAdding(true)}>+ Báo vấn đề</button>
        )
      )}

      {canReport && isMobile && (
        <button className="dw-att-add" onClick={() => setAdding(true)}>+ Báo vấn đề</button>
      )}

      {isMobile && adding && (
        <MobileEditSheet title="Báo cáo vấn đề" onClose={() => { setAdding(false); setContent('') }} onSave={submit} saving={saving} saveLabel="Gửi">
          <Field label="Nội dung vấn đề">
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Mô tả vướng mắc khi triển khai..." />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
