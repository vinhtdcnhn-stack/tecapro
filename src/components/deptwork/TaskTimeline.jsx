import { useState, useEffect, useCallback, useRef } from 'react'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import useIsMobile from '../contracts/useIsMobile'
import { API, API_BASE } from '../../config/api'
import {
  ENTRY_TYPES, ENTRY_TYPE_LABEL, ENTRY_TYPE_CLASS, allowedEntryTypes,
} from './deptWorkUtils'

// dd/mm/yyyy HH:mm cho mốc thời gian của mục.
function fmtDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Dòng thời gian trao đổi của một việc: Báo cáo / Chỉ đạo / Quyết định / Trao đổi.
// Đăng được loại nào suy từ vai trò người dùng với việc (rel). Mở mục này (GET) tự
// ghi mốc đã đọc ở server → bảng việc hết nhấp nháy.
// Mỗi mục kèm được ảnh (dán Ctrl+V hoặc chọn tệp), hiển thị ngay trong dòng thời gian.
export default function TaskTimeline({ taskId, task, currentUser, canManage, onChanged, onRead }) {
  const isMobile = useIsMobile()
  const [entries, setEntries] = useState([])
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState('discussion')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState([]) // { file, url }
  const [lightbox, setLightbox] = useState(null) // src ảnh phóng to
  const fileInputRef = useRef(null)

  // Vai trò của người dùng với việc (khớp luật server) → quyết định loại được đăng.
  const uid = currentUser?.id
  const rel = {
    isCreator: task?.created_by === uid,
    isAssignee: task?.assignees?.some(a => a.assignee_id === uid) || false,
    isLead: task?.assignees?.some(a => a.is_lead && a.assignee_id === uid) || false,
    isHead: !!canManage,
  }
  const allowed = allowedEntryTypes(rel)
  const canPost = allowed.length > 0

  // Loại mặc định khi mở ô soạn: ưu tiên Trao đổi nếu được phép.
  const defaultType = allowed.includes('discussion') ? 'discussion' : allowed[0]

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/dept-work/tasks/${taskId}/entries`)
      setEntries(r.ok ? await r.json() : [])
      // GET tự ghi mốc đã đọc ở server → báo cha xóa nền hổ phách dòng việc ngay, không chờ tải lại.
      if (r.ok) onRead?.(taskId)
    } catch (e) { console.error('load timeline:', e) }
  }, [taskId, onRead])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  // Dọn URL xem trước khi rời trang.
  useEffect(() => () => { pending.forEach(p => URL.revokeObjectURL(p.url)) }, [pending])

  function resetComposer() {
    setContent('')
    setPending(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return [] })
    setAdding(false)
  }
  const openComposer = () => { setType(defaultType); setContent(''); setPending([]); setAdding(true) }

  function addImages(files) {
    const imgs = [...files].filter(f => f && f.type.startsWith('image/'))
    if (imgs.length) setPending(prev => [...prev, ...imgs.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }

  // Dán ảnh từ clipboard (Ctrl+V vào ô nội dung).
  function handlePaste(e) {
    const files = [...(e.clipboardData?.items || [])]
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter(Boolean)
    if (files.length) { e.preventDefault(); addImages(files) }
  }

  function removePending(idx) {
    setPending(prev => {
      const next = [...prev]
      const [rm] = next.splice(idx, 1)
      if (rm) URL.revokeObjectURL(rm.url)
      return next
    })
  }

  async function submit() {
    const text = content.trim()
    if (!text && pending.length === 0) { alert('Vui lòng nhập nội dung hoặc đính kèm ảnh.'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/dept-work/tasks/${taskId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_type: type, content: text || '📷 Hình ảnh' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Gửi thất bại'); return }
      // Tải ảnh đính kèm (nếu có) lên mục vừa tạo.
      for (const p of pending) {
        const form = new FormData()
        form.append('image', p.file)
        await fetch(`${API}/dept-work/entries/${d.id}/images`, { method: 'POST', body: form })
      }
      resetComposer()
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!confirm('Xóa nội dung này khỏi dòng thời gian?')) return
    try {
      const res = await fetch(`${API}/dept-work/entries/${id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Xóa thất bại'); return }
      await load(); onChanged?.()
    } catch { alert('Có lỗi xảy ra.') }
  }

  const typeOptions = ENTRY_TYPES.filter(t => allowed.includes(t.key))

  // Xem trước ảnh đã chọn trong ô soạn (dùng chung desktop + mobile).
  const previewStrip = pending.length > 0 && (
    <div className="dw-tl-preview">
      {pending.map((p, idx) => (
        <div key={idx} className="dw-tl-preview-item">
          <img src={p.url} alt="" />
          <button type="button" onClick={() => removePending(idx)} title="Bỏ ảnh">×</button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="dw-detail-section">
      <h4 className="dw-detail-title">Dòng thời gian — báo cáo · chỉ đạo · trao đổi ({entries.length})</h4>

      <div className="dw-tl-list">
        {entries.map(e => (
          <div key={e.id} className="dw-tl-item">
            <div className="dw-tl-head">
              <span className={`dw-tl-tag ${ENTRY_TYPE_CLASS[e.entry_type] || ''}`}>{ENTRY_TYPE_LABEL[e.entry_type] || e.entry_type}</span>
              <span className="dw-tl-author">{e.author_name || '—'}</span>
              <span className="dw-tl-time">{fmtDateTime(e.created_at)}</span>
              {(canManage || e.author_id === uid) && (
                <button className="dw-tl-del" onClick={() => remove(e.id)} title="Xóa">✕</button>
              )}
            </div>
            <p className="dw-pre dw-tl-content">{e.content}</p>
            {e.images?.length > 0 && (
              <div className="dw-tl-imgs">
                {e.images.map(img => (
                  <img
                    key={img.id}
                    src={`${API_BASE}${img.file_path}`}
                    alt={img.file_name}
                    title={img.file_name}
                    onClick={() => setLightbox(`${API_BASE}${img.file_path}`)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="dash-empty">Chưa có nội dung nào.</p>}
      </div>

      {canPost && !isMobile && (
        adding ? (
          <div className="dw-tl-add">
            <select className="dw-tl-type" value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <div className="dw-tl-box">
              {previewStrip}
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Nhập báo cáo, chỉ đạo, quyết định hoặc trao đổi… (dán ảnh trực tiếp bằng Ctrl+V)"
                autoFocus
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => { addImages(e.target.files); e.target.value = '' }}
            />
            <div className="dw-tl-add-actions">
              <button type="button" className="dw-tl-img-btn" onClick={() => fileInputRef.current?.click()}>🖼️ Thêm ảnh</button>
              <button className="cancel-btn" onClick={resetComposer}>Hủy</button>
              <button className="save-btn" onClick={submit} disabled={saving}>{saving ? 'Đang gửi…' : 'Gửi'}</button>
            </div>
          </div>
        ) : (
          <button className="dw-att-add" onClick={openComposer}>+ Thêm nội dung</button>
        )
      )}

      {canPost && isMobile && (
        <button className="dw-att-add" onClick={openComposer}>+ Thêm nội dung</button>
      )}

      {isMobile && adding && (
        <MobileEditSheet title="Thêm nội dung" onClose={resetComposer} onSave={submit} saving={saving} saveLabel="Gửi">
          <Field label="Loại">
            <select value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Nội dung">
            <textarea value={content} onChange={e => setContent(e.target.value)} onPaste={handlePaste} placeholder="Báo cáo, chỉ đạo, quyết định hoặc trao đổi…" />
          </Field>
          <Field label="Ảnh đính kèm">
            {previewStrip}
            <input type="file" accept="image/*" multiple onChange={e => { addImages(e.target.files); e.target.value = '' }} />
          </Field>
        </MobileEditSheet>
      )}

      {lightbox && (
        <div className="dw-tl-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  )
}
