export default function ContractTable({ contracts, searchTerm, onManage }) {
  const filteredContracts = contracts.filter(c => {
    const term = (searchTerm || '').toLowerCase()
    return (
      c.contract_no?.toLowerCase().includes(term) ||
      c.project_name?.toLowerCase().includes(term) ||
      c.customer_name?.toLowerCase().includes(term)
    )
  })

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    const num = Number(value)
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN')
  }

  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th className="sticky-col-1">Quản trị</th>
            <th className="sticky-col-2">Số HĐ</th>
            <th>Tên dự án</th>
            <th>Chủ đầu tư</th>
            <th>Ngày ký</th>
            <th>Gói thầu</th>
            <th>Trước VAT</th>
            <th>Sau VAT</th>
            <th>USD</th>
            <th>PM chính</th>
            <th>Trạng thái</th>
            <th>Hoàn thành</th>
          </tr>
        </thead>
        <tbody>
          {filteredContracts.length === 0 ? (
            <tr>
              <td colSpan="12" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : (
            filteredContracts.map((c) => (
              <tr key={c.id}>
                <td className="sticky-col-1">
                  <button 
                    className="edit-btn" 
                    onClick={() => {
                      if (onManage) onManage(c)
                    }}
                  >
                    Quản trị
                  </button>
                </td>
                <td className="sticky-col-2">{c.contract_no || '-'}</td>
                <td>{c.project_name || '-'}</td>
                <td>{c.customer_name || '-'}</td>
                <td>{formatDate(c.contract_date)}</td>
                <td>{c.tender_name || '-'}</td>
                <td>{formatCurrency(c.amount_before_vat)}</td>
                <td>{formatCurrency(c.amount_after_vat)}</td>
                <td>
                  {c.currency_code === 'USD' 
                    ? formatCurrency(c.amount_after_vat) 
                    : '-'}
                </td>
                <td>{c.pm_name || '-'}</td>
                <td>{c.status || '-'}</td>
                <td>-</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
