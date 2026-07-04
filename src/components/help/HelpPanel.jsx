import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { usePermission } from '../../hooks/usePermission'
import { HELP_GROUPS } from './helpTopics'
import './help.css'

// Panel hướng dẫn sử dụng, mở từ icon ❓ trên Header. Cấu trúc 2 cấp: nhóm phân hệ
// → từng trang/tab con, mỗi cấp là accordion. Ô lọc tìm trong toàn bộ nội dung;
// nhóm/trang lọc theo quyền lớp A của người dùng.

function pageMatches(page, q) {
  return (
    page.title.toLowerCase().includes(q) ||
    page.sections.some(s =>
      s.heading.toLowerCase().includes(q) ||
      s.items.some(it => it.toLowerCase().includes(q))
    )
  )
}

// `target` ({ groupId, pageId } | null, từ resolveHelpTarget): trang hướng dẫn ứng với
// vị trí người dùng đang đứng. Component được MOUNT MỚI mỗi lần mở (Header render có
// điều kiện) nên state khởi tạo thẳng từ target — panel hiện ra là bung sẵn đúng
// nhóm/trang và cuộn tới đó.
export default function HelpPanel({ onClose, target = null }) {
  const { has } = usePermission()
  const [filter, setFilter] = useState('')
  const [openGroupId, setOpenGroupId] = useState(target?.groupId ?? null)
  const [openPageId, setOpenPageId] = useState(target?.pageId ?? null)

  // Esc đóng panel
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Cuộn tới trang hướng dẫn của vị trí đang đứng (một lần, ngay sau khi mount).
  useEffect(() => {
    if (!target?.pageId) return
    document.getElementById(`help-page-${target.pageId}`)?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const query = filter.trim().toLowerCase()

  // Lọc theo quyền trước, rồi theo từ khóa (khớp ở trang nào giữ trang đó).
  const groups = useMemo(() => {
    return HELP_GROUPS
      .filter(g => !g.perm || has(g.perm))
      .map(g => {
        const pages = g.pages
          .filter(p => !p.perm || has(p.perm))
          .filter(p => !query || pageMatches(p, query))
        return { ...g, pages }
      })
      .filter(g => g.pages.length > 0)
  }, [has, query])

  function toggleGroup(id) {
    setOpenGroupId(cur => (cur === id ? null : id))
    setOpenPageId(null)
  }

  // Render qua portal ra <body>: Header (.topbar) có backdrop-filter nên position:fixed
  // bên trong nó bị neo theo header thay vì cả màn hình → panel bị kẹt trong thanh menu.
  return createPortal(
    <div className="help-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="help-drawer" role="dialog" aria-modal="true" aria-label="Hướng dẫn sử dụng">
        <div className="help-head">
          <h2>❓ Hướng dẫn sử dụng</h2>
          <button type="button" className="help-close" aria-label="Đóng" onClick={onClose}>✕</button>
        </div>

        <input
          type="search"
          className="help-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Tìm trong hướng dẫn (tên trang, nút, từ khóa...)"
          aria-label="Tìm trong hướng dẫn"
        />

        <div className="help-topics">
          {groups.length === 0 && (
            <p className="help-empty">Không tìm thấy nội dung phù hợp.</p>
          )}
          {groups.map((g) => {
            const gOpen = query ? true : openGroupId === g.id
            return (
              <div key={g.id} className={`help-group${gOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="help-group-title"
                  aria-expanded={gOpen}
                  onClick={() => toggleGroup(g.id)}
                >
                  <span className="help-topic-icon">{g.icon}</span>
                  {g.title}
                  <span className="help-topic-caret">{gOpen ? '▾' : '▸'}</span>
                </button>
                {gOpen && (
                  <div className="help-group-body">
                    {g.pages.map((p) => {
                      const pOpen = query ? true : openPageId === p.id
                      return (
                        <div key={p.id} id={`help-page-${p.id}`} className={`help-topic${pOpen ? ' open' : ''}`}>
                          <button
                            type="button"
                            className="help-topic-title"
                            aria-expanded={pOpen}
                            onClick={() => setOpenPageId(cur => (cur === p.id ? null : p.id))}
                          >
                            {p.title}
                            <span className="help-topic-caret">{pOpen ? '▾' : '▸'}</span>
                          </button>
                          {pOpen && (
                            <div className="help-topic-body">
                              {p.sections.map((s) => (
                                <div key={s.heading} className="help-section">
                                  <h3>{s.heading}</h3>
                                  <ul>
                                    {s.items.map((it, i) => <li key={i}>{it}</li>)}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </div>,
    document.body
  )
}
