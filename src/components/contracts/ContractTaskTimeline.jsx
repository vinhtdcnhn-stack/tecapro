import { useState, useEffect, useCallback } from 'react'
import MobileEditSheet, { Field } from './MobileEditSheet'
import useIsMobile from './useIsMobile'
import { API } from '../../config/api'
import {
  ENTRY_TYPES, ENTRY_TYPE_LABEL, ENTRY_TYPE_CLASS, allowedEntryTypes, fmtDateTime,
} from './taskEntryUtils'

// Dòng thời gian trao đổi của một việc HĐ: Báo cáo / Chỉ đạo / Quyết định / Trao đổi.
// Đăng được loại nào suy từ vai trò người dùng với việc (rel). Mở mục này (GET) tự
// ghi mốc đã đọc ở server → dòng việc hết chấm chưa đọc sau khi tab tải lại.
export default function ContractTaskTimeline({ taskId, task, currentUser, canManage, onChanged }) {
  const isMobile = useIsMobile()
  const [entries, setEntries] = useState([])
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState('discussion')
  const [saving, setSaving] = useState(false)

  // Vai trò của người dùng với việc (khớp luật server) → quyết định loại được đăng.
  const uid = Number(currentUser?.id)
  const rel = {
    isCreator: Number(task?.created_by) === uid,
    isAssignee: Number(task?.assigned_to) === uid,
    isManager: !!canManage,
  }
  const allowed = allowedEntryTypes(rel)
  const canPost = allowed.length > 0

  // Loại mặc định khi mở ô soạn: ưu tiên Trao đổi nếu được phép.
  const defaultType = allowed.includes('discussion') ? 'discussion' : allowed[0]

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/tasks/${taskId}/entries`)
      setEntries(r.ok ? await r.json() : [])
    } catch (e) { console.error('load timeline:', e) }
  }, [taskId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  const openComposer = () => { setType(defaultType); setContent(''); setAdding(true) }

  async function submit() {
    const text = content.trim()
    if (!text) { alert('Vui lòng nhập nội dung.'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/tasks/${taskId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_type: type, content: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Gửi thất bại'); return }
      setContent(''); setAdding(false)
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!confirm('Xóa nội dung này khỏi dòng thời gian?')) return
    try {
      const res = await fetch(`${API}/task-entries/${id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Xóa thất bại'); return }
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
  }

  const typeOptions = ENTRY_TYPES.filter(t => allowed.includes(t.key))

  return (
    <div className="task-detail-section">
      <h4 className="task-detail-title">Dòng thời gian — báo cáo · chỉ đạo · trao đổi ({entries.length})</h4>

      <div className="task-tl-list">
        {entries.map(e => (
          <div key={e.id} className="task-tl-item">
            <div className="task-tl-head">
              <span className={`task-tl-tag ${ENTRY_TYPE_CLASS[e.entry_type] || ''}`}>{ENTRY_TYPE_LABEL[e.entry_type] || e.entry_type}</span>
              <span className="task-tl-author">{e.author_name || '—'}</span>
              <span className="task-tl-time">{fmtDateTime(e.created_at)}</span>
              {(canManage || Number(e.author_id) === uid) && (
                <button className="task-tl-del" onClick={() => remove(e.id)} title="Xóa">✕</button>
              )}
            </div>
            <p className="task-pre task-tl-content">{e.content}</p>
          </div>
        ))}
        {entries.length === 0 && <p className="task-detail-empty">Chưa có nội dung nào.</p>}
      </div>

      {canPost && !isMobile && (
        adding ? (
          <div className="task-tl-add">
            <select className="task-tl-type" value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Nhập báo cáo, chỉ đạo, quyết định hoặc trao đổi..."
              autoFocus
            />
            <div className="task-tl-add-actions">
              <button className="cancel-btn" onClick={() => { setAdding(false); setContent('') }}>Hủy</button>
              <button className="save-btn" onClick={submit} disabled={saving}>{saving ? 'Đang gửi…' : 'Gửi'}</button>
            </div>
          </div>
        ) : (
          <button className="task-tl-add-btn" onClick={openComposer}>+ Thêm nội dung</button>
        )
      )}

      {canPost && isMobile && (
        <button className="task-tl-add-btn" onClick={openComposer}>+ Thêm nội dung</button>
      )}

      {isMobile && adding && (
        <MobileEditSheet title="Thêm nội dung" onClose={() => { setAdding(false); setContent('') }} onSave={submit} saving={saving} saveLabel="Gửi">
          <Field label="Loại">
            <select value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Nội dung">
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Báo cáo, chỉ đạo, quyết định hoặc trao đổi..." />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
