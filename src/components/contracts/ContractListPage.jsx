import { useState, useEffect } from 'react'

export default function ContractListPage({ contracts, searchTerm, onManage, onLoadContracts }) {
  const [localContracts, setLocalContracts] = useState([])

  useEffect(() => {
    console.log('ContractListPage mounted')
    if (onLoadContracts) {
      onLoadContracts()
    }
  }, [])

  useEffect(() => {
    console.log('Contract API response:', contracts)
    setLocalContracts(contracts || [])
  }, [contracts])

  const filteredContracts = localContracts.filter(c => {
    const term = (searchTerm || '').toLowerCase()
    return (
      c.contract_no?.toLowerCase().includes(term) ||
      c.project_name?.toLowerCase().includes(term) ||
      c.customer_name?.toLowerCase().includes(term)
    )
  })

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('vi-VN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(value)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN')
  }

  return (
    <div className="contract-list-page">
      <div className="contract-list-toolbar">
        <button 
          className="add-btn" 
          onClick={() => alert('Chức năng thêm hợp đồng sẽ được phát triển sau')}
        >
          Thêm hợp đồng
        </button>
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm (Số HĐ, Tên dự án, Chủ đầu tư...)"
            value={searchTerm}
            onChange={(e) => {
              const event = new CustomEvent('contract-search-change', { detail: e.target.value })
              window.dispatchEvent(event)
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div className="contract-list-table-wrapper">
        <table className="contract-list-table">
          <thead>
            <tr>
              <th style={{ minWidth: '100px' }}>Quản trị</th>
              <th style={{ minWidth: '120px' }}>Số HĐ</th>
              <th style={{ minWidth: '200px' }}>Tên dự án</th>
              <th style={{ minWidth: '150px' }}>Chủ đầu tư</th>
              <th style={{ minWidth: '100px' }}>Ngày ký</th>
              <th style={{ minWidth: '150px' }}>Gói thầu</th>
              <th style={{ minWidth: '120px', textAlign: 'right' }}>Trước VAT</th>
              <th style={{ minWidth: '120px', textAlign: 'right' }}>Sau VAT</th>
              <th style={{ minWidth: '100px', textAlign: 'right' }}>USD</th>
              <th style={{ minWidth: '150px' }}>PM chính</th>
              <th style={{ minWidth: '100px' }}>Trạng thái</th>
              <th style={{ minWidth: '100px' }}>Hoàn thành</th>
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
                  <td>
                    <button 
                      className="edit-btn" 
                      onClick={() => {
                        console.log('Contract ID:', c.id)
                        if (onManage) onManage(c)
                      }}
                    >
                      Quản trị
                    </button>
                  </td>
                  <td>{c.contract_no || '-'}</td>
                  <td>{c.project_name || '-'}</td>
                  <td>{c.customer_name || '-'}</td>
                  <td>{formatDate(c.contract_date)}</td>
                  <td>{c.tender_name || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.amount_before_vat)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.amount_after_vat)}</td>
                  <td style={{ textAlign: 'right' }}>
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
    </div>
  )
}
