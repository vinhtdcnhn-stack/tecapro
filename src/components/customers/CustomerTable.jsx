import { useState } from 'react'

export default function CustomerTable({ customers, searchTerm, userRole, onEdit }) {
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

  return (
    <>
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
              <tr key={c.id}>
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
    </>
  )
}
