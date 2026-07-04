import useIsMobile from '../contracts/useIsMobile'
import MobileCardList from '../common/MobileCardList'

export default function SupplierTable({ suppliers, searchTerm, userRole, onEdit }) {
  const isMobile = useIsMobile()
  const filtered = suppliers.filter(s => {
    const term = (searchTerm || '').toLowerCase()
    return (
      s.code?.toLowerCase().includes(term) ||
      s.name?.toLowerCase().includes(term) ||
      s.tax_code?.toLowerCase().includes(term) ||
      s.contact_person?.toLowerCase().includes(term) ||
      s.phone?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term)
    )
  })

  if (isMobile) {
    return (
      <MobileCardList
        items={filtered}
        emptyText="Không tìm thấy kết quả nào phù hợp."
        onCardClick={userRole == 1 ? onEdit : undefined}
        audit={{ table: 'supplier', id: (s) => s.id }}
        title={(s) => s.name}
        badges={(s) => [s.is_active
          ? { text: 'Hoạt động', cls: 'is-admin' }
          : { text: 'Ngừng', cls: 'is-danger' }]}
        meta={(s) => [
          s.code ? `Mã: ${s.code}` : null,
          s.tax_code ? `MST: ${s.tax_code}` : null,
          s.contact_person ? `LH: ${s.contact_person}` : null,
          s.phone ? `☎ ${s.phone}` : null,
          s.email || null,
        ]}
      />
    )
  }

  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th>Mã NCC</th>
            <th>Tên nhà cung cấp</th>
            <th>Mã số thuế</th>
            <th>Người liên hệ</th>
            <th>Số điện thoại</th>
            <th>Email</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : filtered.map(s => (
            <tr
              key={s.id}
              onDoubleClick={userRole == 1 ? () => onEdit(s) : undefined}
              style={userRole == 1 ? { cursor: 'pointer' } : undefined}
              title={userRole == 1 ? 'Nhấn đúp để sửa' : undefined}
            >
              <td>{s.code || '-'}</td>
              <td>{s.name}</td>
              <td>{s.tax_code || '-'}</td>
              <td>{s.contact_person || '-'}</td>
              <td>{s.phone || '-'}</td>
              <td>{s.email || '-'}</td>
              <td>
                <span style={{ color: s.is_active ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                  {s.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
                </span>
              </td>
              <td>
                {userRole == 1 && (
                  <button className="edit-btn" onClick={() => onEdit(s)}>Sửa</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
