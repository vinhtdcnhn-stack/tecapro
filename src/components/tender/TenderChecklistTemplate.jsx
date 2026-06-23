import { useState, useEffect, useMemo, useCallback } from 'react'
import { API } from '../../config/api'
import TemplateItemModal from './TemplateItemModal'

// Quản lý MẪU checklist công việc dùng chung (1 bộ mặc định cho Ban Đấu thầu).
// Trưởng phòng/admin thêm–sửa–xoá đầu việc mẫu (có việc con). Khi mở 1 gói thầu,
// người làm thầu bấm "Áp dụng mẫu" để đổ toàn bộ vào checklist của gói rồi giao người.

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

export default function TenderChecklistTemplate({ canEdit }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // { item } | { parentId } | 'new'

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}/tender/checklist-template`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [load])

  const tree = useMemo(() => buildTree(items), [items])

  async function remove(it) {
    if (!confirm(`Xoá đầu việc mẫu "${it.title}" (và các việc con)?`)) return
    const res = await fetch(`${API}/tender/checklist-template/${it.id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('Không thể xoá đầu việc mẫu.')
  }

  function renderItem(it, level) {
    return (
      <div key={it.id} className="tender-ci">
        <div className="tender-ci-row" style={{ paddingLeft: 8 + level * 22 }}>
          <span className="tender-ci-title">{it.title}</span>
          <span className="tender-muted">{it.department_name || ''}</span>
          {it.description && <span className="tender-muted tender-tpl-desc">{it.description}</span>}
          {canEdit && (
            <span className="tender-ci-actions">
              <button className="btn-link" onClick={() => setModal({ parentId: it.id })} title="Thêm việc con">+ con</button>
              <button className="btn-link" onClick={() => setModal({ item: it })}>Sửa</button>
              <button className="btn-link danger" onClick={() => remove(it)}>Xoá</button>
            </span>
          )}
        </div>
        {it.children?.map(c => renderItem(c, level + 1))}
      </div>
    )
  }

  return (
    <div className="tender-checklist">
      <p className="dash-sub" style={{ marginTop: 0 }}>
        Bộ đầu việc chuẩn dùng chung. Khi mở một gói thầu, bấm <strong>“Áp dụng mẫu”</strong> ở
        tab Checklist để đổ toàn bộ vào gói, sau đó thêm/bớt và giao người phụ trách.
      </p>
      <div className="tender-checklist-head">
        <span className="tender-muted">{items.length} đầu việc trong mẫu</span>
        {canEdit && <button className="btn-primary" onClick={() => setModal('new')}>+ Thêm đầu việc</button>}
      </div>

      {loading ? (
        <p className="dash-empty">Đang tải…</p>
      ) : !tree.length ? (
        <p className="dash-empty">Mẫu đang trống. Thêm các đầu việc thường gặp để tái dùng cho mọi gói thầu.</p>
      ) : (
        <div className="tender-ci-tree">{tree.map(it => renderItem(it, 0))}</div>
      )}

      {modal && (
        <TemplateItemModal
          item={modal.item || null}
          parentId={modal.parentId || null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
