import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { filterSystemGroups } from './systemNav'
import './BottomNav.css'

// Thanh điều hướng dưới cùng — CHỈ hiện trên mobile (CSS ẩn ở desktop). Cho phép nhảy
// giữa các module hay dùng chỉ bằng 1 chạm, thay vì mở hamburger 2 bước. Đây là lối tắt:
// hamburger vẫn giữ menu đầy đủ (Tra cứu bảo hành, đăng xuất…). RBAC lớp A lọc như Header.
//
// Ô nào có nhiều mục con thì chạm sẽ BUNG menu nổi trên thanh để chọn thẳng (không phải
// vào trong mới thấy), giữ tối đa chỗ hiển thị:
//  • "Công việc": Dự án/CGCN + Đấu thầu (danh sách phẳng)
//  • "Hệ thống": Người dùng, Phòng ban, Phân quyền, Sao lưu… (theo nhóm, dùng systemNav)
const WORK_CHILDREN = [
  { label: 'Dự án và chuyển giao công nghệ', path: '/cong-viec/kt-co-dien', perm: 'module.deptwork.view' },
  { label: 'Kế hoạch đấu thầu',              path: '/cong-viec/dau-thau',   perm: 'module.tender.view' },
]

// Icon nét mảnh (currentColor) — đồng bộ phong cách với nút trợ giúp ở Header.
const Icon = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const IconHome = () => <Icon><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Icon>
const IconDoc = () => <Icon><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></Icon>
const IconWork = () => <Icon><path d="M4 7h16v13H4z" /><path d="M9 7V4h6v3" /><path d="M4 12h16" /></Icon>
const IconInbox = () => <Icon><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v7H3v-7z" /></Icon>
const IconShield = () => <Icon><path d="M12 3l7 3v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6z" /><path d="M9 12l2 2 4-4" /></Icon>
const IconGear = () => <Icon><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Icon>

export default function BottomNav({ inboxCount = 0, homeUnread = 0 }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { has, isAdmin } = usePermission()
  const path = location.pathname
  const [openMenu, setOpenMenu] = useState(null) // 'work' | 'system' | null

  const workChildren = WORK_CHILDREN.filter(c => has(c.perm))
  const systemGroups = filterSystemGroups({ has, isAdmin })
  const systemFlat = systemGroups.flatMap(g => g.items)

  function go(to) { setOpenMenu(null); navigate(to) }

  // Chạm ô có mục con: nhiều mục → bật/tắt menu chọn; đúng 1 mục → vào thẳng.
  function openOrGo(menuKey, children, fallback) {
    if (children.length > 1) setOpenMenu(o => (o === menuKey ? null : menuKey))
    else if (children.length === 1) go(children[0].path)
    else if (fallback) go(fallback)
  }

  // Danh sách rút gọn (tối đa 5 ô) — chỉ giữ ô người dùng có quyền.
  const items = [
    { key: 'home', label: 'Trang chủ', Icon: IconHome, show: true, badge: homeUnread,
      active: path === '/' || path === '/giaoban', onClick: () => go('/') },
    { key: 'co', label: 'Hợp đồng', Icon: IconDoc, show: has('module.contracts.view'),
      active: path.startsWith('/qlda'), onClick: () => go('/qlda') },
    { key: 'work', label: 'Công việc', Icon: IconWork, show: workChildren.length > 0,
      active: path.startsWith('/cong-viec') || path.startsWith('/viec-dau-thau') || openMenu === 'work',
      onClick: () => openOrGo('work', workChildren), hasMenu: workChildren.length > 1, expanded: openMenu === 'work' },
    { key: 'appr', label: 'Đề xuất', Icon: IconInbox, show: has('module.approvals.view'),
      active: path.startsWith('/de-xuat'), badge: inboxCount, onClick: () => go('/de-xuat') },
    { key: 'wty', label: 'Bảo hành', Icon: IconShield, show: has('module.warranty_lookup.view'),
      active: path.startsWith('/tracuu'), onClick: () => go('/tracuu') },
    { key: 'sys', label: 'Hệ thống', Icon: IconGear, show: has('module.system.view') || systemFlat.length > 0,
      active: path.startsWith('/quantri') || openMenu === 'system',
      onClick: () => openOrGo('system', systemFlat, '/quantri'), hasMenu: systemFlat.length > 1, expanded: openMenu === 'system' },
  ].filter(it => it.show)

  return (
    <>
      {openMenu && (
        <>
          <div className="bottomnav-backdrop" onClick={() => setOpenMenu(null)} />
          {/* Menu "Công việc": danh sách phẳng */}
          {openMenu === 'work' && (
            <div className="bottomnav-popup" role="menu" aria-label="Chọn nhóm công việc">
              {workChildren.map(c => (
                <button
                  key={c.path}
                  type="button"
                  role="menuitem"
                  className={`bottomnav-popup-item${path.startsWith(c.path) ? ' is-active' : ''}`}
                  onClick={() => go(c.path)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {/* Menu "Hệ thống": theo nhóm (cuộn nếu dài) */}
          {openMenu === 'system' && (
            <div className="bottomnav-popup bottomnav-popup--scroll" role="menu" aria-label="Chọn chức năng hệ thống">
              {systemGroups.map(group => (
                <div key={group.category} className="bottomnav-popup-group">
                  <div className="bottomnav-popup-cat">{group.category}</div>
                  {group.items.map(item => {
                    const to = `/quantri/${item.section}`
                    return (
                      <button
                        key={item.section}
                        type="button"
                        role="menuitem"
                        className={`bottomnav-popup-item${path.startsWith(to) ? ' is-active' : ''}`}
                        onClick={() => go(to)}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <nav className="bottomnav" aria-label="Điều hướng nhanh">
        {items.map(it => (
          <button
            key={it.key}
            type="button"
            className={`bottomnav-item${it.active ? ' is-active' : ''}`}
            aria-current={it.active && !it.hasMenu ? 'page' : undefined}
            aria-haspopup={it.hasMenu ? 'menu' : undefined}
            aria-expanded={it.hasMenu ? it.expanded : undefined}
            onClick={it.onClick}
          >
            <span className="bottomnav-icon">
              <it.Icon />
              {it.hasMenu && <span className="bottomnav-caret" aria-hidden="true">▾</span>}
              {it.badge > 0 && (
                <span className="bottomnav-badge" aria-label={`${it.badge} mục chờ`}>
                  {it.badge > 99 ? '99+' : it.badge}
                </span>
              )}
            </span>
            <span className="bottomnav-label">{it.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
