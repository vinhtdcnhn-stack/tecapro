import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'

const GROUPS = [
  {
    category: 'I. Danh mục',
    items: [
      { label: 'QUẢN LÝ NGƯỜI DÙNG',    section: 'users',       viewPerm: 'system.users.view' },
      { label: 'QUẢN LÝ PHÒNG BAN',     section: 'departments', viewPerm: 'system.departments.view' },
      { label: 'QUẢN LÝ VỊ TRÍ',        section: 'positions',   viewPerm: 'system.positions.view' },
      { label: 'QUẢN LÝ KHÁCH HÀNG',    section: 'customers',   viewPerm: 'system.customers.view' },
      { label: 'QUẢN LÝ NHÀ CUNG CẤP',  section: 'suppliers',   viewPerm: 'system.suppliers.view' },
      { label: 'QUẢN LÝ LOẠI BIÊN BẢN', section: 'bb-types',    viewPerm: 'system.bbtypes.view' },
    ],
  },
  {
    category: 'II. Quản trị hệ thống',
    items: [
      { label: 'PHÂN QUYỀN',          section: 'phan-quyen',          adminOnly: true },
      { label: 'SAO LƯU / KHÔI PHỤC', section: 'backup',              adminOnly: true },
      { label: 'NHẬT KÝ THAY ĐỔI',    section: 'nhat-ky-thay-doi',    adminOnly: true },
      { label: 'NHẬT KÝ TELEGRAM',    section: 'telegram-log',        adminOnly: true },
      { label: 'CHẨN ĐOÁN HIỆU NĂNG', section: 'chan-doan-hieu-nang', adminOnly: true },
    ],
  },
  {
    category: 'III. Khác',
    items: [
      { label: 'GÓP Ý CẢI THIỆN', section: 'feedback' },
    ],
  },
]

export default function Sidebar() {
  const { has, isAdmin } = usePermission()
  const groups = GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        if (item.viewPerm && !has(item.viewPerm)) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside className="admin-sidebar">
      {groups.map(group => (
        <div key={group.category} className="admin-sidebar-section">
          <div className="admin-sidebar-category">{group.category}</div>
          <div className="admin-sidebar-items">
            {group.items.map(item => (
              <NavLink
                key={item.section}
                to={`/quantri/${item.section}`}
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
