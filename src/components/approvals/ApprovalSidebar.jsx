import { NavLink } from 'react-router-dom'

// Sidebar (desktop) / thanh tab ngang (mobile) cho module Đề xuất / Phê duyệt.
// Nhóm "Quản trị" (tất cả đề xuất + loại đơn) chỉ hiện cho admin.
const BASE = '/de-xuat'
const GROUPS = [
  {
    category: 'I. Đề xuất của tôi',
    items: [
      { label: 'Đơn của tôi', section: 'my' },
      { label: 'Chờ tôi duyệt', section: 'inbox' },
      { label: 'Sắp đến lượt tôi', section: 'upcoming' },
      { label: 'Tôi theo dõi', section: 'following' },
    ],
  },
  {
    category: 'II. Quản trị',
    items: [
      { label: 'Tất cả đề xuất', section: 'all', adminOnly: true },
      { label: 'Loại đơn', section: 'forms', adminOnly: true },
    ],
  },
]

export default function ApprovalSidebar({ canManage }) {
  const groups = GROUPS
    .map(group => ({ ...group, items: group.items.filter(i => !i.adminOnly || canManage) }))
    .filter(group => group.items.length > 0)

  return (
    <aside className="admin-sidebar approval-sidebar">
      {groups.map(group => (
        <div key={group.category} className="admin-sidebar-section">
          <div className="admin-sidebar-category">{group.category}</div>
          <div className="admin-sidebar-items">
            {group.items.map(item => (
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
      ))}
    </aside>
  )
}
