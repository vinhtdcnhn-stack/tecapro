import { useState, useEffect, useCallback, useRef } from 'react'
import { API, API_BASE } from '../../config/api'
import { useAuth } from '../../context/AuthContext'

const PAGE_SIZE = 50

const CATEGORIES = [
  { value: 'feature', label: 'Đề xuất tính năng' },
  { value: 'ui', label: 'Giao diện' },
  { value: 'performance', label: 'Hiệu năng' },
  { value: 'bug', label: 'Báo lỗi' },
  { value: 'other', label: 'Khác' },
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const STATUSES = [
  { value: 'open', label: 'Mới', color: '#2563eb', bg: '#eff6ff' },
  { value: 'in_progress', label: 'Đang xử lý', color: '#b45309', bg: '#fffbeb' },
  { value: 'done', label: 'Đã xong', color: '#15803d', bg: '#f0fdf4' },
  { value: 'rejected', label: 'Không tiếp nhận', color: '#b91c1c', bg: '#fef2f2' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

function fmtDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN')
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.open
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: 600, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`,
    }}>{s.label}</span>
  )
}

// Trang Góp ý cải thiện phần mềm. Mọi người dùng gửi góp ý (đính kèm ảnh dán từ clipboard),
// xem lại góp ý của mình + trạng thái xử lý. Admin xem & xử lý tất cả góp ý.
export default function FeedbackPanel() {
  const { user } = useAuth()
  const isAdmin = user?.role == 1

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open') // ngầm định: chỉ xem góp ý "Mới"

  // Form gửi góp ý
  const [category, setCategory] = useState('feature')
  const [content, setContent] = useState('')
  const [pending, setPending] = useState([]) // { file, url }
  const [submitting, setSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState(null) // src ảnh phóng to

  const load = useCallback(async (p) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ page: p, pageSize: PAGE_SIZE })
      if (statusFilter) qs.set('status', statusFilter)
      const res = await fetch(`${API}/feedback?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không tải được góp ý.')
      setItems(prev => (p === 1 ? data.items : [...prev, ...data.items]))
      setTotal(data.total)
      setPage(p)
    } catch (e) {
      setError(e.message || 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loader async: setState sau await; chạy lại khi đổi bộ lọc trạng thái
    load(1)
  }, [load])

  // Thu nhận ảnh dán từ clipboard (Ctrl+V vào ô nội dung).
  function handlePaste(e) {
    const files = [...(e.clipboardData?.items || [])]
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter(Boolean)
    if (files.length) {
      e.preventDefault()
      addImages(files)
    }
  }

  function addImages(files) {
    setPending(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f) }))])
  }

  function removePending(idx) {
    setPending(prev => {
      const next = [...prev]
      const [rm] = next.splice(idx, 1)
      if (rm) URL.revokeObjectURL(rm.url)
      return next
    })
  }

  const fileInputRef = useRef(null)

  async function handleSubmit() {
    if (!content.trim()) { setError('Vui lòng nhập nội dung góp ý.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), category }),
      })
      const fb = await res.json()
      if (!res.ok) throw new Error(fb.error || 'Không gửi được góp ý.')
      // Tải ảnh đính kèm (nếu có) lên góp ý vừa tạo.
      for (const p of pending) {
        const form = new FormData()
        form.append('image', p.file)
        await fetch(`${API}/feedback/${fb.id}/images`, { method: 'POST', body: form })
        URL.revokeObjectURL(p.url)
      }
      setContent('')
      setPending([])
      setCategory('feature')
      await load(1)
    } catch (e) {
      setError(e.message || 'Có lỗi xảy ra.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const res = await fetch(`${API}/feedback/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      // Đang lọc theo trạng thái mà mục vừa đổi sang trạng thái khác → gỡ khỏi danh sách.
      if (statusFilter && status !== statusFilter) {
        setItems(prev => prev.filter(it => it.id !== id))
        setTotal(t => Math.max(0, t - 1))
      } else {
        setItems(prev => prev.map(it => (it.id === id ? { ...it, status } : it)))
      }
    } catch {
      alert('Không cập nhật được trạng thái.')
    }
  }

  async function handleNoteSave(id, admin_note) {
    try {
      const res = await fetch(`${API}/feedback/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note }),
      })
      if (!res.ok) throw new Error()
      setItems(prev => prev.map(it => (it.id === id ? { ...it, admin_note } : it)))
    } catch {
      alert('Không lưu được phản hồi.')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Xóa góp ý này?')) return
    try {
      const res = await fetch(`${API}/feedback/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setItems(prev => prev.filter(it => it.id !== id))
      setTotal(t => Math.max(0, t - 1))
    } catch {
      alert('Không xóa được góp ý.')
    }
  }

  const hasMore = items.length < total

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>GÓP Ý CẢI THIỆN PHẦN MỀM</h2>
        <button className="add-btn" onClick={() => load(1)} disabled={loading}>🔄 Làm mới</button>
      </div>

      {/* Form gửi góp ý */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '14px', fontWeight: 600 }}>Loại góp ý:</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onPaste={handlePaste}
          placeholder="Nhập nội dung góp ý của bạn… (có thể dán ảnh chụp màn hình trực tiếp bằng Ctrl+V)"
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
        />

        {/* Xem trước ảnh đính kèm */}
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            {pending.map((p, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={p.url} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <button onClick={() => removePending(idx)} title="Bỏ ảnh"
                  style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <button className="add-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang gửi…' : 'Gửi góp ý'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
            🖼️ Chọn ảnh
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => { addImages([...e.target.files]); e.target.value = '' }}
          />
          <span style={{ color: '#64748b', fontSize: '13px' }}>Mẹo: dán ảnh trực tiếp vào ô nội dung bằng Ctrl+V.</span>
        </div>
      </div>

      {error && <div style={{ color: '#c00', marginBottom: '10px' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          {isAdmin ? 'Tất cả góp ý' : 'Góp ý của tôi'} ({total})
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#475569' }}>Lọc trạng thái:</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
            <option value="">Tất cả</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Danh sách góp ý dạng thẻ */}
      <div className="content-scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
        {items.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>Chưa có góp ý nào.</div>
        ) : (
          items.map(it => (
            <FeedbackCard
              key={it.id}
              item={it}
              isAdmin={isAdmin}
              canDelete={isAdmin || String(it.user_id) === String(user?.id)}
              onStatusChange={handleStatusChange}
              onNoteSave={handleNoteSave}
              onDelete={handleDelete}
              onOpenImage={setLightbox}
            />
          ))
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        {hasMore ? (
          <button className="add-btn" onClick={() => load(page + 1)} disabled={loading}>
            {loading ? 'Đang tải…' : 'Tải thêm'}
          </button>
        ) : (
          items.length > 0 && <span style={{ color: '#888', fontSize: '13px' }}>Đã hiển thị hết.</span>
        )}
      </div>

      {/* Lightbox xem ảnh phóng to */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: '6px' }} />
        </div>
      )}
    </>
  )
}

function FeedbackCard({ item, isAdmin, canDelete, onStatusChange, onNoteSave, onDelete, onOpenImage }) {
  const [note, setNote] = useState(item.admin_note || '')
  const [editingNote, setEditingNote] = useState(false)

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <StatusBadge status={item.status} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
            {CATEGORY_LABEL[item.category] || 'Khác'}
          </span>
          {isAdmin && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              · {item.user_name || item.user_email || `#${item.user_id}`}
            </span>
          )}
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>· {fmtDateTime(item.created_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin && (
            <select value={item.status} onChange={e => onStatusChange(item.id, e.target.value)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {canDelete && (
            <button onClick={() => onDelete(item.id)} title="Xóa"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>🗑️</button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px', color: '#1e293b' }}>
        {item.content}
      </div>

      {item.images?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {item.images.map(img => (
            <img
              key={img.id}
              src={`${API_BASE}${img.file_path}`}
              alt={img.file_name}
              onClick={() => onOpenImage(`${API_BASE}${img.file_path}`)}
              style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'zoom-in' }}
            />
          ))}
        </div>
      )}

      {/* Phản hồi của admin */}
      {(item.admin_note || isAdmin) && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
          {isAdmin && editingNote ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Phản hồi cho người góp ý…"
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }} />
              <button className="add-btn" onClick={() => { onNoteSave(item.id, note); setEditingNote(false) }}>Lưu</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                <strong>Phản hồi:</strong> {item.admin_note || <span style={{ color: '#94a3b8' }}>(chưa có)</span>}
              </div>
              {isAdmin && (
                <button onClick={() => { setNote(item.admin_note || ''); setEditingNote(true) }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563eb', fontSize: '13px' }}>
                  {item.admin_note ? 'Sửa' : 'Thêm phản hồi'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
