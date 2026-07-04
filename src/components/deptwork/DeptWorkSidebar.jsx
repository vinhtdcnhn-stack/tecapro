import { NavLink } from 'react-router-dom'
import { DEPTWORK_BASE, DEPTWORK_ITEMS } from './deptWorkNav'

// Sidebar (desktop) cho module KT Cơ điện. Trên mobile sidebar bị ẩn (App.css) → việc chọn
// mục do nút icon trên Header đảm nhiệm (DeptWorkPage đăng ký qua useRegisterSectionNav).
export default function DeptWorkSidebar({ canManage }) {
  const items = DEPTWORK_ITEMS.filter(i => !i.manageOnly || canManage)
  return (
    <aside className="admin-sidebar deptwork-sidebar">
      <div className="admin-sidebar-section">
        <div className="admin-sidebar-category">Công việc</div>
        <div className="admin-sidebar-items">
          {items.map(item => (
            <NavLink
              key={item.section}
              to={`${DEPTWORK_BASE}/${item.section}`}
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
