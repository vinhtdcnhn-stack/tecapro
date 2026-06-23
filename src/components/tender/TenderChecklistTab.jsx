import { useState, useEffect, useMemo, useCallback } from 'react'
import { API } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from './tenderUtils'
import ChecklistItemModal from './ChecklistItemModal'
import ChecklistItemAttachments from './ChecklistItemAttachments'

const ITEM_STATUSES = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']
const ITEM_STATUS_COLOR = {
  'Chờ xử lý':      { bg: '#f1f5f9', fg: '#475569' },
  'Đang thực hiện': { bg: '#fef9c3', fg: '#a16207' },
  'Hoàn thành':     { bg: '#dcfce7', fg: '#15803d' },
  'Hủy':            { bg: '#fee2e2', fg: '#b91c1c' },
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

  const canContribute = (it) => canEdit || Number(it.assignee_id) === Number(user?.id)

  async function changeStatus(it, status) {
    const res = await fetch(`${API}/tender/checklist/${it.id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
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
    return (
      <div key={it.id} className="tender-ci">
        <div className="tender-ci-row" style={{ paddingLeft: 8 + level * 22 }}>
          <button className="tender-ci-toggle" onClick={() => setExpanded(e => ({ ...e, [it.id]: !e[it.id] }))}>
            {isOpen ? '▾' : '▸'}
          </button>
          <span className="tender-ci-title">{it.title}</span>
          <span className="tender-muted">{it.department_name || ''}</span>
          <span className="tender-muted">{it.assignee_name || 'Chưa giao'}</span>
          <span className="tender-muted">{fmtDate(it.due_date)}</span>
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
          {canEdit && (
            <span className="tender-ci-actions">
              <button className="btn-link" onClick={() => setModal({ parentId: it.id })} title="Thêm việc con">+ con</button>
              <button className="btn-link" onClick={() => setModal({ item: it })}>Sửa</button>
              <button className="btn-link danger" onClick={() => remove(it)}>Xoá</button>
            </span>
          )}
        </div>
        {isOpen && (
          <div className="tender-ci-detail" style={{ paddingLeft: 30 + level * 22 }}>
            {it.description && <p className="tender-ci-desc">{it.description}</p>}
            <ChecklistItemAttachments itemId={it.id} canContribute={canContribute(it)} />
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
