import { useState, useEffect } from 'react'

export default function ContractListPage({ contracts, searchTerm: parentSearchTerm, onManage, onLoadContracts }) {
  const [localContracts, setLocalContracts] = useState([])
  const [localSearchTerm, setLocalSearchTerm] = useState(parentSearchTerm || '')

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

  useEffect(() => {
    setLocalSearchTerm(parentSearchTerm || '')
  }, [parentSearchTerm])

  const filteredContracts = localContracts.filter(c => {
    const term = (localSearchTerm || '').toLowerCase()
    return (
      c.contract_no?.toLowerCase().includes(term) ||
      c.project_name?.toLowerCase().includes(term) ||
      c.customer_name?.toLowerCase().includes(term)
    )
  })

  // Tính toán thống kê
  const stats = {
    total: localContracts.length,
    active: localContracts.filter(c => c.status === 'Active').length,
    completed: localContracts.filter(c => c.status === 'Completed').length,
    totalValue: localContracts.reduce((sum, c) => sum + (parseFloat(c.amount_after_vat) || 0), 0)
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '-'
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Active': { className: 'status-active', label: 'Đang thực hiện' },
      'Completed': { className: 'status-completed', label: 'Hoàn thành' },
      'Pending': { className: 'status-pending', label: 'Chờ xử lý' },
      'Cancelled': { className: 'status-cancelled', label: 'Hủy bỏ' }
    }
    const config = statusConfig[status] || { className: 'bg-gray-100 text-gray-800', label: status }
    return (
      <span className={`status-badge ${config.className}`}>
        {config.label}
      </span>
    )
  }

  const getAvatarBadge = (name) => {
    if (!name) return <span className="text-gray-400">-</span>
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3)
    return (
      <div className="pm-badge">
        <span className="pm-avatar">{initials}</span>
        <span className="text-gray-700">{name}</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">HỢP ĐỒNG BÁN</h1>
        <p className="page-subtitle">Quản lý danh sách hợp đồng đầu ra của công ty</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-label">Tổng hợp đồng</p>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Đang thực hiện</p>
          <p className="stat-value text-green-600">{stats.active}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Hoàn thành</p>
          <p className="stat-value text-blue-600">{stats.completed}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Tổng giá trị</p>
          <p className="stat-value text-tecapro-600">{formatCurrency(stats.totalValue)} ₫</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <button 
          className="btn-primary"
          onClick={() => alert('Chức năng thêm hợp đồng sẽ được phát triển sau')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm hợp đồng
        </button>
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm (Số HĐ, Tên dự án, Chủ đầu tư...)"
            value={localSearchTerm}
            onChange={(e) => {
              setLocalSearchTerm(e.target.value)
              const event = new CustomEvent('contract-search-change', { detail: e.target.value })
              window.dispatchEvent(event)
            }}
            className="search-input"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Quản trị</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Số HĐ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Tên dự án</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Chủ đầu tư</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Ngày ký</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Gói thầu</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Trước VAT</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Sau VAT</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">USD</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">PM chính</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">Hoàn thành</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-12 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm">Không tìm thấy kết quả nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr 
                    key={c.id} 
                    className="table-row"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button 
                        className="btn-manage"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('Contract ID:', c.id)
                          if (onManage) onManage(c)
                        }}
                        title="Quản trị"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{c.contract_no || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{c.project_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.customer_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(c.contract_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.tender_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatCurrency(c.amount_before_vat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatCurrency(c.amount_after_vat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                      {c.currency_code === 'USD' 
                        ? formatCurrency(c.amount_after_vat) 
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{getAvatarBadge(c.pm_name)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">-</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
