import { useState, useEffect, useCallback } from 'react'
import { API, API_BASE } from '../../config/api'
import Modal from '../common/Modal'
import { isoToDisplay } from '../contracts/DateInput'
import { statusInfo, fmtMoney } from './approvalUtils'

const fmtSize = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)

const DECISION = {
  pending: { label: 'Chờ', cls: 'status-pending' },
  approved: { label: 'Đã duyệt', cls: 'status-completed' },
  rejected: { label: 'Từ chối', cls: 'status-cancelled' },
}
const fmtDT = (s) => (s ? new Date(s).toLocaleString('vi-VN') : '')

// Hiển thị giá trị 1 trường theo kiểu.
function fmtValue(field, v) {
  if (v == null || v === '') return '—'
  switch (field.field_type) {
    case 'date': return isoToDisplay(v)
    case 'date_range': return v.from || v.to ? `${isoToDisplay(v.from)} → ${isoToDisplay(v.to)}` : '—'
    case 'checkbox': return v ? 'Có' : 'Không'
    case 'money': return fmtMoney(v, field.config?.currency)
    default: return String(v)
  }
}

// Hiển thị 1 ô của bảng (read-only) theo kiểu cột.
function fmtCell(col, v) {
  if (v == null || v === '') return ''
  if (col.type === 'date') return isoToDisplay(v)
  if (col.type === 'money') return Number(v).toLocaleString('vi-VN')
  return String(v)
}

// Bảng read-only trong chi tiết đơn.
function TableValue({ field, rows }) {
  const cols = field.config?.columns || []
  const list = Array.isArray(rows) ? rows : []
  if (!cols.length) return <span className="ar-note">—</span>
  return (
    <table className="ar-grid ar-grid-ro">
      <thead><tr>{cols.map(c => <th key={c.key}>{c.label}{c.type === 'money' ? ` (${c.currency || 'VND'})` : ''}</th>)}</tr></thead>
      <tbody>
        {list.map((r, i) => (
          <tr key={i}>{cols.map(c => <td key={c.key}>{fmtCell(c, r[c.key])}</td>)}</tr>
        ))}
        {list.length === 0 && <tr><td colSpan={cols.length} className="ar-note" style={{ textAlign: 'center' }}>Không có dòng nào.</td></tr>}
      </tbody>
    </table>
  )
}

// Chi tiết đơn: dữ liệu, chuỗi duyệt (timeline), và nút Duyệt/Từ chối nếu tới lượt tôi.
export default function RequestDetail({ requestId, currentUserId, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    fetch(`${API}/approvals/requests/${requestId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setError('Không tải được chi tiết đơn.'))
  }, [requestId])
  useEffect(() => { load() }, [load])

  // Tôi có phải người duyệt đang chờ ở bước hiện tại không?
  const canDecide = !!data && data.status === 'pending' && (data.steps || []).some(s =>
    s.step_order === data.current_step && s.status === 'pending' &&
    (s.approvers || []).some(a => a.approver_id === currentUserId && a.decision === 'pending')
  )
  // Người gửi được đính kèm khi đơn còn nháp/chờ duyệt.
  const canAttach = !!data && data.requester_id === currentUserId && ['draft', 'pending'].includes(data.status)

  async function onUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${API}/approvals/requests/${requestId}/attachments`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Tải tệp thất bại.')
      load()
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function delAttachment(aid) {
    if (!confirm('Xóa tệp này?')) return
    const r = await fetch(`${API}/approvals/request-attachments/${aid}`, { method: 'DELETE' })
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Không thể xóa.'); return }
    load()
  }

  async function decide(action) {
    if (action === 'reject' && !comment.trim() && !confirm('Từ chối không kèm lý do?')) return
    setBusy(true); setError('')
    try {
      const r = await fetch(`${API}/approvals/requests/${requestId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() || null }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Thao tác thất bại.')
      onChanged?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sInfo = data ? statusInfo(data.status) : null

  return (
    <Modal isOpen onClose={onClose} labelledBy="ar-detail-title"
      overlayClassName="ar-drawer-overlay" contentClassName="ar-drawer-panel">
      <div className="ar-drawer-header">
        <h2 id="ar-detail-title">{data ? data.title : 'Chi tiết đơn'}</h2>
        <button className="ar-drawer-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      <div className="ar-drawer-body">
        {!data && <p className="approval-empty">{error || 'Đang tải…'}</p>}
        {data && (
          <>
            <div className="ar-detail-head">
              <span>{data.form_icon ? `${data.form_icon} ` : ''}{data.form_name}</span>
              <span className={`status-badge ${sInfo.cls}`}>{sInfo.label}</span>
              <span className="ar-note">Người gửi: {data.requester_name} · {fmtDT(data.submitted_at || data.created_at)}</span>
            </div>

            {/* Dữ liệu đơn */}
            {(data.fields || []).length > 0 && (
              <div className="ar-detail-section">
                {data.fields.map(f => (
                  f.field_type === 'table' ? (
                    <div key={f.field_key} className="ar-kv-block">
                      <div className="ar-k">{f.label}</div>
                      <TableValue field={f} rows={data.form_data?.[f.field_key]} />
                    </div>
                  ) : (
                    <div key={f.field_key} className="ar-kv">
                      <span className="ar-k">{f.label}</span>
                      <span className="ar-v">{fmtValue(f, data.form_data?.[f.field_key])}</span>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Chuỗi duyệt */}
            <div className="ar-detail-section">
              <h4 className="ar-subhead">Quy trình duyệt</h4>
              {(data.steps || []).map(s => (
                <div key={s.id} className={`ar-step-line${s.step_order === data.current_step && data.status === 'pending' ? ' ar-step-current' : ''}`}>
                  <div className="ar-step-line-head">
                    <b>{s.step_order}. {s.name}</b>
                    <span className={`status-badge ${(DECISION[s.status] || {}).cls || ''}`}>{(DECISION[s.status] || {}).label || s.status}</span>
                  </div>
                  <div className="ar-step-approvers-list">
                    {(s.approvers || []).map(a => (
                      <div key={a.id} className="ar-approver">
                        <span>{a.approver_name}</span>
                        <span className={`status-badge ${(DECISION[a.decision] || {}).cls || ''}`}>{(DECISION[a.decision] || {}).label || a.decision}</span>
                        {a.comment && <span className="ar-note">“{a.comment}”</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Người theo dõi */}
            {(data.followers || []).length > 0 && (
              <div className="ar-detail-section">
                <h4 className="ar-subhead">Người theo dõi</h4>
                <div className="ar-followers">
                  {data.followers.map(fl => (
                    <span key={fl.user_id} className="ar-follower-chip">{fl.full_name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Đính kèm */}
            <div className="ar-detail-section">
              <h4 className="ar-subhead">Tệp đính kèm</h4>
              {(data.attachments || []).length === 0 && <p className="ar-note">Chưa có tệp.</p>}
              {(data.attachments || []).map(a => (
                <div key={a.id} className="ar-att">
                  <a href={`${API_BASE}${a.file_path}`} target="_blank" rel="noreferrer">{a.file_name}</a>
                  <span className="ar-note">{fmtSize(a.file_size)}</span>
                  {(canAttach || a.uploaded_by === currentUserId) && (
                    <button className="ar-icon-del" title="Xóa" onClick={() => delAttachment(a.id)}>✕</button>
                  )}
                </div>
              ))}
              {canAttach && (
                <label className="btn btn-sm ar-upload">
                  + Thêm tệp
                  <input type="file" hidden onChange={onUpload} disabled={busy} />
                </label>
              )}
            </div>

            {error && <p className="ab-error">{error}</p>}

            {/* Khu vực quyết định */}
            {canDecide && (
              <div className="ar-detail-section ar-decide">
                <h4 className="ar-subhead">Bạn cần xử lý đơn này</h4>
                <textarea
                  className="ab-input" rows={2} placeholder="Ý kiến / lý do (tùy chọn khi duyệt, nên có khi từ chối)"
                  value={comment} onChange={e => setComment(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </div>
      <div className="ar-drawer-footer">
        <button type="button" className="btn btn-light" onClick={onClose}>Đóng</button>
        {canDecide && (
          <>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => decide('reject')}>Từ chối</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide('approve')}>
              {busy ? 'Đang xử lý…' : 'Duyệt'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
