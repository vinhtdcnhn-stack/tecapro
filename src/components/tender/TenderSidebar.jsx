import { NavLink } from 'react-router-dom'

// Sidebar (desktop) / tab ngang (mobile) cho module Kế hoạch Đấu thầu.
const BASE = '/cong-viec/dau-thau'
const ITEMS = [
  { label: 'Danh sách gói', section: 'list' },
  { label: 'Việc của tôi', section: 'my' },
  { label: 'Mẫu checklist', section: 'template', headOnly: true },
  { label: 'Báo cáo', section: 'reports' },
]

export default function TenderSidebar({ isHead }) {
  const items = ITEMS.filter(i => !i.headOnly || isHead)
  return (
    <aside className="admin-sidebar deptwork-sidebar">
      <div className="admin-sidebar-section">
        <div className="admin-sidebar-category">Kế hoạch đấu thầu</div>
        <div className="admin-sidebar-items">
          {items.map(item => (
            <NavLink
              key={item.section}
              to={`${BASE}/${item.section}`}
              className={({ isActive }) => `admin-sidebar-item${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  )
}
