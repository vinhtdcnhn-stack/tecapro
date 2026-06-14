import { NavLink } from 'react-router-dom'

// Sidebar (desktop) / thanh tab ngang (mobile) cho module KT Cơ điện.
// "Quản lý nhóm" chỉ hiện cho trưởng/phó phòng (hoặc admin).
const BASE = '/cong-viec/kt-co-dien'
const ITEMS = [
  { label: 'Bảng công việc', section: 'board' },
  { label: 'Nhật ký công việc', section: 'logs' },
  { label: 'Năng lực', section: 'capacity' },
  { label: 'Quản lý nhóm', section: 'teams', manageOnly: true },
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
