import { NavLink } from 'react-router-dom'

// Sidebar (desktop) / thanh tab ngang (mobile) cho module KT Cơ điện.
const BASE = '/cong-viec/kt-co-dien'
const ITEMS = [
  { label: 'Bảng công việc', section: 'board' },
  { label: 'Nhật ký công việc', section: 'logs' },
  { label: 'Năng lực', section: 'capacity' },
]

export default function DeptWorkSidebar({ canManage }) {
  const items = ITEMS.filter(i => !i.manageOnly || canManage)
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
