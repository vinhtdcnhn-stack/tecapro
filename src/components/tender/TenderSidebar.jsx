import { NavLink } from 'react-router-dom'
import { TENDER_BASE, TENDER_ITEMS } from './tenderNav'

// Sidebar (desktop) cho module Kế hoạch Đấu thầu. Trên mobile sidebar bị ẩn (App.css) →
// việc chọn mục do nút icon trên Header đảm nhiệm (TenderPage đăng ký qua useRegisterSectionNav).
export default function TenderSidebar({ isHead }) {
  const items = TENDER_ITEMS.filter(i => !i.headOnly || isHead)
  return (
    <aside className="admin-sidebar deptwork-sidebar">
      <div className="admin-sidebar-section">
        <div className="admin-sidebar-category">Kế hoạch đấu thầu</div>
        <div className="admin-sidebar-items">
          {items.map(item => (
            <NavLink
              key={item.section}
              to={`${TENDER_BASE}/${item.section}`}
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
