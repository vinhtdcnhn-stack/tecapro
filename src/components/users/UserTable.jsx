import useIsMobile from '../contracts/useIsMobile'
import MobileCardList from '../common/MobileCardList'
import { isUserActive } from '../../lib/userStatus'

export default function UserTable({ users, searchTerm, departmentFilter, roleFilter, statusFilter, userRole, onEdit }) {
  const isMobile = useIsMobile()
  const filteredUsers = users.filter(u => {
    // statusFilter: '' = tất cả | 'active' = đang làm việc | 'inactive' = đã nghỉ việc
    if (statusFilter === 'active' && !isUserActive(u)) return false
    if (statusFilter === 'inactive' && isUserActive(u)) return false
    if (departmentFilter) {
      // Khớp cả phòng CHÍNH lẫn ban KIÊM NHIỆM — lọc "Ban X" ra cả người kiêm nhiệm Ban X.
      const inPrimary = String(u.department_id) === String(departmentFilter)
      const inExtra = Array.isArray(u.extra_departments)
        && u.extra_departments.some(d => String(d.id) === String(departmentFilter))
      if (!inPrimary && !inExtra) return false
    }
    if (roleFilter && String(Number(u.role) === 1 ? 'admin' : 'user') !== roleFilter) return false
    const term = (searchTerm || '').toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.employee_code?.toLowerCase().includes(term) ||
      u.phone?.toLowerCase().includes(term) ||
      u.department_name?.toLowerCase().includes(term) ||
      (Array.isArray(u.extra_departments) && u.extra_departments.some(d => d.name?.toLowerCase().includes(term)))
    )
  })

  const extraDeptText = (u) => (
    Array.isArray(u.extra_departments) && u.extra_departments.length > 0
      ? ' + kiêm nhiệm ' + u.extra_departments.map(d => d.name).join(', ')
      : ''
  )

  if (isMobile) {
    return (
      <MobileCardList
        items={filteredUsers}
        emptyText="Không tìm thấy kết quả nào phù hợp."
        onCardClick={userRole == 1 ? onEdit : undefined}
        audit={{ table: 'app_user', id: (u) => u.id }}
        title={(u) => u.full_name}
        badges={(u) => [
          Number(u.role) === 1
            ? { text: 'Admin', cls: 'is-admin' }
            : { text: 'User', cls: 'is-muted' },
          ...(isUserActive(u) ? [] : [{ text: 'Đã nghỉ việc', cls: 'is-muted' }]),
        ]}
        meta={(u) => [
          `${u.department_name || '-'}${extraDeptText(u)}`,
          u.phone ? `☎ ${u.phone}` : null,
          u.telegram_chat_id ? `TG: ${u.telegram_chat_id}` : null,
          u.manager_name ? `QL: ${u.manager_name}` : null,
        ]}
      />
    )
  }

  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Phòng ban</th>
            <th>Số điện thoại</th>
            <th>Telegram ID</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Quản lý trực tiếp</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : (
            filteredUsers.map((u) => (
              <tr
                key={u.id}
                onDoubleClick={userRole == 1 ? () => onEdit(u) : undefined}
                // Người đã nghỉ vẫn nằm trong danh sách (dữ liệu cũ tham chiếu tới họ) nhưng
                // làm mờ để không lẫn với nhân sự đang làm việc.
                style={{
                  ...(userRole == 1 ? { cursor: 'pointer' } : null),
                  ...(isUserActive(u) ? null : { opacity: 0.55, background: '#f9fafb' }),
                }}
                title={userRole == 1 ? 'Nhấn đúp để sửa' : undefined}
              >
                <td>{u.full_name}</td>
                <td>
                  {u.department_name || '-'}
                  {Array.isArray(u.extra_departments) && u.extra_departments.length > 0 && (
                    <span
                      style={{ marginLeft: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}
                      title={'Kiêm nhiệm: ' + u.extra_departments.map(d => d.name).join(', ')}
                    >
                      + kiêm nhiệm {u.extra_departments.map(d => d.name).join(', ')}
                    </span>
                  )}
                </td>
                <td>{u.phone || '-'}</td>
                <td>{u.telegram_chat_id || '-'}</td>
                <td>{Number(u.role) === 1 ? 'Admin' : 'User'}</td>
                <td>
                  {isUserActive(u) ? (
                    <span style={{ color: '#047857' }}>Đang làm việc</span>
                  ) : (
                    <span style={{ color: '#b91c1c', fontWeight: 600 }} title="Không đăng nhập được, không hiện khi giao việc mới">
                      Đã nghỉ việc
                    </span>
                  )}
                </td>
                <td>{u.manager_name || '-'}</td>
                <td>
                  {userRole == 1 && (
                    <button className="edit-btn" onClick={() => onEdit(u)}>
                      Sửa
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
