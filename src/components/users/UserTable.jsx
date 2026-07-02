export default function UserTable({ users, searchTerm, departmentFilter, roleFilter, userRole, onEdit }) {
  const filteredUsers = users.filter(u => {
    if (departmentFilter && String(u.department_id) !== String(departmentFilter)) return false
    if (roleFilter && String(Number(u.role) === 1 ? 'admin' : 'user') !== roleFilter) return false
    const term = (searchTerm || '').toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.employee_code?.toLowerCase().includes(term) ||
      u.phone?.toLowerCase().includes(term) ||
      u.department_name?.toLowerCase().includes(term)
    )
  })

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
            <th>Quản lý trực tiếp</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : (
            filteredUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.department_name || '-'}</td>
                <td>{u.phone || '-'}</td>
                <td>{u.telegram_chat_id || '-'}</td>
                <td>{Number(u.role) === 1 ? 'Admin' : 'User'}</td>
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
