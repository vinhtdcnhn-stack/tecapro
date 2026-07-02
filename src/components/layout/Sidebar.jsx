import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'

const ITEMS = [
  { label: 'QUẢN LÝ NGƯỜI DÙNG',   section: 'users',       viewPerm: 'system.users.view' },
  { label: 'QUẢN LÝ PHÒNG BAN',    section: 'departments', viewPerm: 'system.departments.view' },
  { label: 'QUẢN LÝ VỊ TRÍ',       section: 'positions',   viewPerm: 'system.positions.view' },
  { label: 'QUẢN LÝ KHÁCH HÀNG',   section: 'customers',   viewPerm: 'system.customers.view' },
  { label: 'QUẢN LÝ NHÀ CUNG CẤP', section: 'suppliers',   viewPerm: 'system.suppliers.view' },
  { label: 'QUẢN LÝ LOẠI BIÊN BẢN', section: 'bb-types',   viewPerm: 'system.bbtypes.view' },
  { label: 'GÓP Ý CẢI THIỆN',      section: 'feedback'    },
  { label: 'NHẬT KÝ TELEGRAM',     section: 'telegram-log', adminOnly: true },
  { label: 'SAO LƯU / KHÔI PHỤC',  section: 'backup', adminOnly: true },
  { label: 'PHÂN QUYỀN',           section: 'phan-quyen', adminOnly: true },
  { label: 'NHẬT KÝ THAY ĐỔI',     section: 'nhat-ky-thay-doi', adminOnly: true },
  { label: 'CHẨN ĐOÁN HIỆU NĂNG',  section: 'chan-doan-hieu-nang', adminOnly: true },
]

export default function Sidebar() {
  const { has, isAdmin } = usePermission()
  const items = ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.viewPerm && !has(item.viewPerm)) return false
    return true
  })
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
