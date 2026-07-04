import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { filterSystemGroups } from './systemNav'

export default function Sidebar() {
  const { has, isAdmin } = usePermission()
  const groups = filterSystemGroups({ has, isAdmin })

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
