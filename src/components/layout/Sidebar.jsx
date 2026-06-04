import { NavLink } from 'react-router-dom'

const ITEMS = [
  { label: 'QUẢN LÝ NGƯỜI DÙNG',   section: 'users'       },
  { label: 'QUẢN LÝ PHÒNG BAN',    section: 'departments' },
  { label: 'QUẢN LÝ VỊ TRÍ',       section: 'positions'   },
  { label: 'QUẢN LÝ KHÁCH HÀNG',   section: 'customers'   },
  { label: 'QUẢN LÝ NHÀ CUNG CẤP', section: 'suppliers'   },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {ITEMS.map(item => (
        <NavLink
          key={item.section}
          to={`/quantri/${item.section}`}
          className={({ isActive }) => `sidebar-btn${isActive ? ' active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  )
}
