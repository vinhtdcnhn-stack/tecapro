import { useState, useEffect } from 'react'

export default function ContractTable({ contracts, searchTerm, userRole, onEdit }) {
  const filteredContracts = contracts.filter(c => {
    const term = (searchTerm || '').toLowerCase();
    return (
      c.contract_no?.toLowerCase().includes(term) ||
      c.project_name?.toLowerCase().includes(term) ||
      c.customer_name?.toLowerCase().includes(term) ||
      c.tender_name?.toLowerCase().includes(term) ||
      c.status?.toLowerCase().includes(term)
    )
  })

  // Format currency
  const formatCurrency = (amount, currencyCode = 'VND') => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: currencyCode 
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  // Calculate USD amount
  const calculateUSD = (amountAfterVat, exchangeRate) => {
    if (amountAfterVat === null || amountAfterVat === undefined || !exchangeRate) return '-';
    const usdAmount = amountAfterVat / exchangeRate;
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(usdAmount);
  };

  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th>Số HĐ</th>
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
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredContracts.length === 0 ? (
            <tr>
              <td colSpan="13" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Không tìm thấy kết quả nào phù hợp.
              </td>
            </tr>
          ) : (
            filteredContracts.map((c) => (
              <tr key={c.id}>
                <td>{c.contract_no || '-'}</td>
                <td>{c.project_name || '-'}</td>
                <td>{c.customer_name || '-'}</td>
                <td>{formatDate(c.contract_date)}</td>
                <td>{c.tender_name || '-'}</td>
                <td>{formatCurrency(c.amount_before_vat, c.currency_code)}</td>
                <td>{formatCurrency(c.amount_after_vat, c.currency_code)}</td>
                <td>{calculateUSD(c.amount_after_vat, c.exchange_rate)}</td>
                <td>{c.primary_pm || '-'}</td>
                <td>
                  <span style={{ 
                    color: c.status === 'Đã ký' || c.status === 'Hoàn thành' ? '#28a745' : 
                           c.status === 'Đang thực hiện' ? '#ffc107' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {c.status || 'Chưa xác định'}
                  </span>
                </td>
                <td>
                  <span style={{ 
                    color: c.status === 'Hoàn thành' ? '#28a745' : '#6c757d',
                    fontWeight: 'bold'
                  }}>
                    {c.status === 'Hoàn thành' ? '✓' : '○'}
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
