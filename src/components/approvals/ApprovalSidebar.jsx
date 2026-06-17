import { NavLink } from 'react-router-dom'

// Sidebar (desktop) / thanh tab ngang (mobile) cho module Đề xuất / Phê duyệt.
// "Loại đơn" (form builder) chỉ hiện cho admin.
const BASE = '/de-xuat'
const ITEMS = [
  { label: 'Đơn của tôi', section: 'my' },
  { label: 'Chờ tôi duyệt', section: 'inbox' },
  { label: 'Sắp đến lượt tôi', section: 'upcoming' },
  { label: 'Tôi theo dõi', section: 'following' },
  { label: 'Tất cả đề xuất', section: 'all', adminOnly: true },
  { label: 'Loại đơn', section: 'forms', adminOnly: true },
]

export default function ApprovalSidebar({ canManage }) {
  const items = ITEMS.filter(i => !i.adminOnly || canManage)
  return (
    <aside className="sidebar approval-sidebar">
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
