import { useState, useEffect, useMemo, useCallback } from 'react'
import { API } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from './tenderUtils'
import ChecklistItemModal from './ChecklistItemModal'
import ContractDocumentsTab from '../contracts/ContractDocumentsTab'
import { ContractPermProvider } from '../../context/ContractPermContext'

const ITEM_STATUSES = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']
const ITEM_STATUS_COLOR = {
  'Chờ xử lý':      { bg: '#f1f5f9', fg: '#475569' },
  'Đang thực hiện': { bg: '#fef9c3', fg: '#a16207' },
  'Hoàn thành':     { bg: '#dcfce7', fg: '#15803d' },
  'Hủy':            { bg: '#fee2e2', fg: '#b91c1c' },
}

// Nhãn trạng thái review của đầu việc (curate → duyệt). 'draft' = chưa gửi → không hiện.
const REVIEW_BADGE = {
  pending:  { label: 'Chờ duyệt', bg: '#fef9c3', fg: '#a16207' },
  approved: { label: 'Đã duyệt',  bg: '#dcfce7', fg: '#15803d' },
  returned: { label: 'Bị trả lại', bg: '#fee2e2', fg: '#b91c1c' },
}

// Dựng cây từ danh sách phẳng theo parent_item_id.
function buildTree(items) {
  const byParent = new Map()
  for (const it of items) {
    const key = it.parent_item_id || 0
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(it)
  }
  const attach = (parent) => (byParent.get(parent) || []).map(it => ({ ...it, children: attach(it.id) }))
  return attach(0)
}

export default function TenderChecklistTab({ tenderId, canEdit }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [modal, setModal] = useState(null)   // { item } | { parentId } | 'new'

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/tender/${tenderId}/checklist`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [tenderId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [load])

  const tree = useMemo(() => buildTree(items), [items])
  const progress = useMemo(() => {
    const counted = items.filter(i => i.status !== 'Hủy')
    if (!counted.length) return 0
    const done = counted.filter(i => i.status === 'Hoàn thành').length
    return Math.round((done / counted.length) * 100)
  }, [items])

  // Đầu việc đã duyệt Đạt bị KHOÁ: không sửa/xoá/đổi trạng thái/đổi tệp cho tới khi
  // Trưởng ban thu hồi kết luận (ở tab Review & Comment).
  const isLocked = (it) => it.review_status === 'approved'
  const canContribute = (it) => !isLocked(it) && (canEdit || Number(it.assignee_id) === Number(user?.id))

  async function changeStatus(it, status) {
    let reason
    // Yêu cầu làm lại: Hoàn thành → Đang thực hiện. Hỏi lý do để gửi cho người nhận việc.
    if (it.status === 'Hoàn thành' && status === 'Đang thực hiện') {
      reason = prompt(`Lý do yêu cầu làm lại (sẽ hiển thị cho người nhận việc — đây là lần sửa thứ ${Number(it.rework_count || 0) + 1}):`)
      if (reason == null) return                       // người dùng huỷ
      reason = reason.trim()
      if (!reason) { alert('Vui lòng nhập lý do yêu cầu làm lại.'); return }
    }
    const res = await fetch(`${API}/tender/checklist/${it.id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    })
    if (res.ok) load()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Không thể đổi trạng thái.') }
  }

  async function remove(it) {
    if (!confirm(`Xoá đầu việc "${it.title}" (và các việc con)?`)) return
    const res = await fetch(`${API}/tender/checklist/${it.id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Không thể xoá đầu việc.')
  }

  async function submitReview(it) {
    if (!confirm(`Gửi đầu việc "${it.title}" sang Trưởng ban duyệt?\nNhững file/thư mục đã đánh dấu loại sẽ không nằm trong bản gửi review.`)) return
    const res = await fetch(`${API}/tender/checklist/${it.id}/review/submit`, { method: 'POST' })
    if (res.ok) load()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Không thể gửi review.') }
  }

  async function applyTemplate() {
    const msg = items.length
      ? 'Checklist đã có đầu việc. Áp mẫu sẽ THÊM toàn bộ đầu việc mẫu vào cuối danh sách. Tiếp tục?'
      : 'Đổ toàn bộ đầu việc từ mẫu chuẩn vào checklist?'
    if (!confirm(msg)) return
    const res = await fetch(`${API}/tender/${tenderId}/checklist/apply-template`, { method: 'POST' })
    if (res.ok) load()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Không thể áp dụng mẫu.') }
  }

  function renderItem(it, level) {
    const sc = ITEM_STATUS_COLOR[it.status] || ITEM_STATUS_COLOR['Chờ xử lý']
    const isOpen = !!expanded[it.id]
    const rb = REVIEW_BADGE[it.review_status]
    // Curate được khi là người phụ trách/Trưởng phòng, đầu việc đã Hoàn thành và chưa/đang
    // bị trả lại (chưa gửi duyệt). Cũng là điều kiện hiện nút "Gửi review".
    const canCurate = canEdit && it.status === 'Hoàn thành'
      && (it.review_status === 'draft' || it.review_status === 'returned')
    const locked = isLocked(it)
    return (
      <div key={it.id} className="tender-ci">
        <div className={`tender-ci-row${locked ? ' tender-ci-row--approved' : ''}`} style={{ paddingLeft: 8 + level * 22 }}>
          <button className="tender-ci-toggle" onClick={() => setExpanded(e => ({ ...e, [it.id]: !e[it.id] }))}>
            {isOpen ? '▾' : '▸'}
          </button>
          <span className="tender-ci-title">{it.title}</span>
          <span className="tender-muted">{it.department_name || ''}</span>
          <span className="tender-muted">{it.assignee_name || 'Chưa giao'}</span>
          <span className="tender-muted">{fmtDate(it.due_date)}</span>
          {it.rework_count > 0 && (
            <span className="tender-ci-rework" title={it.rework_reason || ''}>🔁 Sửa lần {it.rework_count}</span>
          )}
          {rb && (
            <span className="tender-badge" style={{ background: rb.bg, color: rb.fg }}
              title={it.review_status === 'returned' ? (it.review_comment || '') : ''}>
              {rb.label}
            </span>
          )}
          {canCurate && (
            <button className="btn-link" onClick={() => submitReview(it)} title="Gửi đầu việc sang Trưởng ban duyệt">
              Gửi review
            </button>
          )}
          {it.attachment_count > 0 && <span className="tender-ci-files">📎 {it.attachment_count}</span>}
          {canContribute(it) ? (
            <select className="tender-ci-status" value={it.status}
              style={{ background: sc.bg, color: sc.fg }}
              onChange={e => changeStatus(it, e.target.value)}>
              {ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className="tender-badge" style={{ background: sc.bg, color: sc.fg }}>{it.status}</span>
          )}
          {canEdit && !locked && (
            <span className="tender-ci-actions">
              <button className="btn-link" onClick={() => setModal({ parentId: it.id })} title="Thêm việc con">+ con</button>
              <button className="btn-link" onClick={() => setModal({ item: it })}>Sửa</button>
              <button className="btn-link danger" onClick={() => remove(it)}>Xoá</button>
            </span>
          )}
          {locked && <span className="tender-ci-lock" title="Đầu việc đã được duyệt — đã khoá. Trưởng ban thu hồi kết luận ở tab Review & Comment để chỉnh sửa.">🔒 Đã khoá</span>}
        </div>
        {isOpen && (
          <div className="tender-ci-detail" style={{ paddingLeft: 30 + level * 22 }}>
            {it.description && <p className="tender-ci-desc">{it.description}</p>}
            {it.rework_count > 0 && it.rework_reason && (
              <p className="tender-ci-rework-note">
                🔁 <strong>Yêu cầu làm lại (lần {it.rework_count}):</strong> {it.rework_reason}
              </p>
            )}
            {it.review_status === 'returned' && it.review_comment && (
              <p className="tender-ci-rework-note">
                ↩ <strong>Trưởng ban trả lại:</strong> {it.review_comment}
              </p>
            )}
            {canCurate && (
              <p className="tender-ci-review-hint">
                <strong>Chuột phải</strong> vào một file để
                <strong> Loại</strong> nó khỏi bản gửi review (không xoá bản gốc) hoặc <strong>Thay thế</strong> bằng
                bản đã sửa; với thư mục dùng nút ⊘ bên cạnh tên. Xong thì bấm <strong>Gửi review</strong>.
              </p>
            )}
            <ContractPermProvider canEdit={canContribute(it) && it.status !== 'Hoàn thành'}>
              <ContractDocumentsTab basePath={`tender/checklist/${it.id}/docs`} allowRootUpload
                review={canCurate ? { itemId: it.id } : null} />
            </ContractPermProvider>
          </div>
        )}
        {it.children?.map(c => renderItem(c, level + 1))}
      </div>
    )
  }

  return (
    <div className="tender-checklist">
      <div className="tender-checklist-head">
        <div className="tender-progress">
          <div className="tender-progress-bar"><div className="tender-progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="tender-progress-label">{progress}% hoàn thành</span>
        </div>
        {canEdit && (
          <div className="tender-checklist-actions">
            <button className="btn-secondary" onClick={applyTemplate}>Áp dụng mẫu</button>
            <button className="btn-primary" onClick={() => setModal('new')}>+ Thêm đầu việc</button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="dash-empty">Đang tải…</p>
      ) : !tree.length ? (
        <p className="dash-empty">Chưa có đầu việc nào.</p>
      ) : (
        <div className="tender-ci-tree">{tree.map(it => renderItem(it, 0))}</div>
      )}

      {modal && (
        <ChecklistItemModal
          tenderId={tenderId}
          item={modal.item || null}
          parentId={modal.parentId || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
