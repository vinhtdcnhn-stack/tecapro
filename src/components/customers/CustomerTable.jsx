import useIsMobile from '../contracts/useIsMobile'
import MobileCardList from '../common/MobileCardList'

export default function CustomerTable({ customers, searchTerm, userRole, onEdit }) {
  const isMobile = useIsMobile()
  const filteredCustomers = customers.filter(c => {
    const term = (searchTerm || '').toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.code?.toLowerCase().includes(term) ||
      c.tax_code?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.contact_person?.toLowerCase().includes(term)
    )
  })

  if (isMobile) {
    return (
      <MobileCardList
        items={filteredCustomers}
        emptyText="Không tìm thấy kết quả nào phù hợp."
        onCardClick={userRole == 1 ? onEdit : undefined}
        audit={{ table: 'customer', id: (c) => c.id }}
        title={(c) => c.name}
        badges={(c) => [c.is_active
          ? { text: 'Hoạt động', cls: 'is-admin' }
          : { text: 'Ngừng', cls: 'is-danger' }]}
        meta={(c) => [
          c.code ? `Mã: ${c.code}` : null,
          c.tax_code ? `MST: ${c.tax_code}` : null,
          c.contact_person ? `LH: ${c.contact_person}` : null,
          c.phone ? `☎ ${c.phone}` : null,
          c.email || null,
        ]}
      />
    )
  }

  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th>Mã khách hàng</th>
            <th>Tên khách hàng</th>
            <th>Mã số thuế</th>
            <th>Người liên hệ</th>
            <th>Số điện thoại</th>
            <th>Email</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredCustomers.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : (
            filteredCustomers.map((c) => (
              <tr
                key={c.id}
                onDoubleClick={userRole == 1 ? () => onEdit(c) : undefined}
                style={userRole == 1 ? { cursor: 'pointer' } : undefined}
                title={userRole == 1 ? 'Nhấn đúp để sửa' : undefined}
              >
                <td>{c.code || '-'}</td>
                <td>{c.name}</td>
                <td>{c.tax_code || '-'}</td>
                <td>{c.contact_person || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>
                  <span style={{ 
                    color: c.is_active ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {c.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </td>
                <td>
                  {userRole == 1 && (
                    <button className="edit-btn" onClick={() => onEdit(c)}>
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
