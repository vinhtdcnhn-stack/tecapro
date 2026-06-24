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
    <aside className="sidebar deptwork-sidebar">
      {items.map(item => (
        <NavLink
          key={item.section}
          to={`${BASE}/${item.section}`}
          className={({ isActive }) => `sidebar-btn${isActive ? ' active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  )
}
