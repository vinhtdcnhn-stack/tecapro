import { NavLink } from 'react-router-dom'
import { APPROVAL_BASE, APPROVAL_GROUPS } from './approvalNav'

// Sidebar (desktop) cho module Đề xuất / Phê duyệt. Trên mobile sidebar bị ẩn (App.css) →
// việc chọn mục do nút icon trên Header đảm nhiệm (ApprovalPage đăng ký qua useRegisterSectionNav).
// Nhóm "Quản trị" (tất cả đề xuất + loại đơn) chỉ hiện cho admin.
export default function ApprovalSidebar({ canManage }) {
  const groups = APPROVAL_GROUPS
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
                to={`${APPROVAL_BASE}/${item.section}`}
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
