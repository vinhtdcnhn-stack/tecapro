import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ITEMS = [
  { label: 'QUẢN LÝ NGƯỜI DÙNG',   section: 'users'       },
  { label: 'QUẢN LÝ PHÒNG BAN',    section: 'departments' },
  { label: 'QUẢN LÝ VỊ TRÍ',       section: 'positions'   },
  { label: 'QUẢN LÝ KHÁCH HÀNG',   section: 'customers'   },
  { label: 'QUẢN LÝ NHÀ CUNG CẤP', section: 'suppliers'   },
  { label: 'QUẢN LÝ LOẠI BIÊN BẢN', section: 'bb-types'   },
  { label: 'NHẬT KÝ TELEGRAM',     section: 'telegram-log', adminOnly: true },
  { label: 'GÓP Ý CẢI THIỆN',      section: 'feedback'    },
  { label: 'SAO LƯU / KHÔI PHỤC',  section: 'backup', adminOnly: true },
  { label: 'PHÂN QUYỀN',           section: 'phan-quyen', adminOnly: true },
  { label: 'NHẬT KÝ THAY ĐỔI',     section: 'nhat-ky-thay-doi', adminOnly: true },
]

export default function Sidebar() {
  const { user } = useAuth()
  const isAdmin = user?.role == 1
  const items = ITEMS.filter(item => !item.adminOnly || isAdmin)
  return (
    <aside className="sidebar">
      {items.map(item => (
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
