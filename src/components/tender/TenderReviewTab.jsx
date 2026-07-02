import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { formatDate } from '../contracts/documentsUtils'
import ContractDocumentsTab from '../contracts/ContractDocumentsTab'
import { ContractPermProvider } from '../../context/ContractPermContext'

// Tab "Review & Comment" — duyệt theo TỪNG ĐẦU VIỆC. Người phụ trách gói đã curate tệp
// (loại bớt / thay thế) rồi gửi lên; Trưởng ban xem bản gửi review và kết luận Đạt / Trả lại.
// Tệp/thư mục hiển thị bằng giao diện 3 phần (cây thư mục · bảng tệp · xem trước) giống tab
// Checklist công việc — chỉ đọc, các đánh dấu "đã loại / thay thế" hiện ngay trên bảng tệp.
const REVIEW_BADGE = {
  pending:  { label: 'Chờ duyệt', bg: '#fef9c3', fg: '#a16207' },
  approved: { label: 'Đã duyệt',  bg: '#dcfce7', fg: '#15803d' },
  returned: { label: 'Bị trả lại', bg: '#fee2e2', fg: '#b91c1c' },
}

export default function TenderReviewTab({ tenderId, isHead }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})   // { [itemId]: bool }
  const [decision, setDecision] = useState({})   // { [itemId]: { conclusion, comment } }

  const load = useCallback(() => {
    setLoading(true)
    apiGet(`/tender/${tenderId}/review`, { conditional: true })
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [tenderId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [load])

  async function reopen(itemId) {
    const comment = prompt('Lý do thu hồi kết luận đã duyệt (sẽ lưu lịch sử, có thể bỏ trống):')
    if (comment == null) return            // người dùng huỷ
    const res = await fetch(`${API}/tender/checklist/${itemId}/review/reopen`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment.trim() }),
    })
    if (res.ok) load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'Không thể thu hồi kết luận.') }
  }

  async function decide(itemId) {
    const d = decision[itemId] || {}
    if (!d.conclusion) { alert('Chọn kết luận Đạt / Trả lại.'); return }
    if (d.conclusion === 'fail' && !(d.comment || '').trim()) { alert('Cần ghi lý do khi Trả lại.'); return }
    const res = await fetch(`${API}/tender/checklist/${itemId}/review/decide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conclusion: d.conclusion, comment: d.comment || '' }),
    })
    if (res.ok) { setDecision(s => ({ ...s, [itemId]: {} })); load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'Không thể lưu kết luận.') }
  }

  const setDec = (id, patch) => setDecision(s => ({ ...s, [id]: { ...s[id], ...patch } }))

  if (loading) return <p className="dash-empty">Đang tải…</p>
  if (!items.length) return <p className="dash-empty">Chưa có đầu việc nào được gửi review.</p>

  return (
    <div className="tender-review">
      <div className="tender-version-list">
        {items.map(it => {
          const rb = REVIEW_BADGE[it.review_status] || REVIEW_BADGE.pending
          const d = decision[it.id] || {}
          const isOpen = !!expanded[it.id]
          return (
            <div key={it.id} className="tender-version">
              <div className="tender-version-head">
                <button className="tender-ci-toggle" onClick={() => setExpanded(e => ({ ...e, [it.id]: !e[it.id] }))}>
                  {isOpen ? '▾' : '▸'}
                </button>
                <span className="tender-ci-title">{it.title}</span>
                <span className="tender-badge" style={{ background: rb.bg, color: rb.fg }}>{rb.label}</span>
                {it.files.length > 0 && <span className="tender-ci-files">📎 {it.files.length}</span>}
                <span className="tender-muted">
                  {it.department_name || ''}{it.assignee_name ? ` · ${it.assignee_name}` : ''}
                  {it.submitted_by_name ? ` · gửi: ${it.submitted_by_name}` : ''}
                  {it.review_submitted_at ? ` · ${formatDate(it.review_submitted_at)}` : ''}
                </span>
              </div>

              {/* Tệp/thư mục gửi review — giao diện 3 phần, chỉ đọc (đã áp đánh dấu loại / thay thế) */}
              {isOpen && (
                <div className="tender-review-docs">
                  <ContractPermProvider canEdit={false}>
                    <ContractDocumentsTab basePath={`tender/checklist/${it.id}/docs`} allowRootUpload />
                  </ContractPermProvider>
                </div>
              )}

              {/* Lịch sử kết luận */}
              {it.reviews.map(r => {
                const badge = r.conclusion === 'pass'
                  ? { label: 'Đạt', bg: '#dcfce7', fg: '#15803d' }
                  : r.conclusion === 'reopen'
                    ? { label: 'Thu hồi duyệt', bg: '#e0e7ff', fg: '#4338ca' }
                    : { label: 'Trả lại', bg: '#fee2e2', fg: '#b91c1c' }
                return (
                  <div key={r.id} className={`tender-review-row ${r.conclusion}`}>
                    <span className="tender-badge" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                    {r.comment && <span className="tender-review-comment">{r.comment}</span>}
                    <span className="tender-muted">{r.reviewer_name} · {formatDate(r.created_at)}</span>
                  </div>
                )
              })}

              {/* Trưởng ban kết luận (chỉ khi đang chờ duyệt) */}
              {isHead && it.review_status === 'pending' && (
                <div className="tender-decide">
                  <select value={d.conclusion || ''} onChange={e => setDec(it.id, { conclusion: e.target.value })}>
                    <option value="">— Kết luận —</option>
                    <option value="pass">Đạt</option>
                    <option value="fail">Trả lại</option>
                  </select>
                  <input className="tender-decide-comment" placeholder="Nhận xét / lý do…"
                    value={d.comment || ''} onChange={e => setDec(it.id, { comment: e.target.value })} />
                  <button className="btn-primary" onClick={() => decide(it.id)}>Lưu kết luận</button>
                </div>
              )}
              {it.review_status === 'approved' && (
                <div className="tender-version-done-row">
                  <p className="tender-version-done">✓ Đầu việc đã được duyệt Đạt.</p>
                  {isHead && (
                    <button className="btn-link" onClick={() => reopen(it.id)}
                      title="Thu hồi kết luận để xem xét lại — đầu việc sẽ mở khoá và chờ duyệt lại">
                      ↩ Thu hồi kết luận
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
