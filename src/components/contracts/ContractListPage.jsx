import { useState, useEffect, useRef } from 'react'
import ContractModal from './ContractModal'

export default function ContractListPage({ contracts, searchTerm: parentSearchTerm, onManage, onLoadContracts, currentUser, users, customers }) {
  const [localContracts, setLocalContracts] = useState([])
  const [localSearchTerm, setLocalSearchTerm] = useState(parentSearchTerm || '')
  const [filters, setFilters] = useState({ contract_no: '', project_name: '', customer_name: '', pm_name: '', status: '' })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [openDropdown, setOpenDropdown] = useState(null)
  const currentDropdownRef = useRef(null)
  
  // Modal state for adding contract
  const [showAddContractModal, setShowAddContractModal] = useState(false)
  
  // Check if user is PM
  const isPM = currentUser?.position_code === 'PM'
  
  // Debug logs
  console.log('=== DEBUG ContractListPage ===')
  console.log('Current User:', currentUser)
  console.log('Position ID:', currentUser?.position_id)
  console.log('Position Code:', currentUser?.position_code)
  console.log('Position:', currentUser?.position)
  console.log('Is PM:', isPM)
  console.log('=============================')

  useEffect(() => { console.log('ContractListPage mounted'); if (onLoadContracts) onLoadContracts() }, [])
  useEffect(() => { console.log('Contract API response:', contracts); setLocalContracts(contracts || []) }, [contracts])
  useEffect(() => { setLocalSearchTerm(parentSearchTerm || '') }, [parentSearchTerm])
  useEffect(() => { function handleClickOutside(event) { if (currentDropdownRef.current && !currentDropdownRef.current.contains(event.target)) setOpenDropdown(null) } document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside) }, [])

  const uniquePMs = [...new Set(localContracts.map(c => c.pm_name).filter(Boolean))]
  const uniqueStatuses = [...new Set(localContracts.map(c => c.status).filter(Boolean))]

  const filteredAndSortedContracts = localContracts.filter(c => {
    const term = (localSearchTerm || '').toLowerCase()
    const matchesSearch = !term || (c.contract_no?.toLowerCase().includes(term) || c.project_name?.toLowerCase().includes(term) || c.customer_name?.toLowerCase().includes(term) || c.pm_name?.toLowerCase().includes(term) || c.status?.toLowerCase().includes(term))
    const matchesContractNo = !filters.contract_no || c.contract_no?.toLowerCase().includes(filters.contract_no.toLowerCase())
    const matchesProjectName = !filters.project_name || c.project_name?.toLowerCase().includes(filters.project_name.toLowerCase())
    const matchesCustomerName = !filters.customer_name || c.customer_name?.toLowerCase().includes(filters.customer_name.toLowerCase())
    const matchesPM = !filters.pm_name || c.pm_name === filters.pm_name
    const matchesStatus = !filters.status || c.status === filters.status
    return matchesSearch && matchesContractNo && matchesProjectName && matchesCustomerName && matchesPM && matchesStatus
  }).sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    let aVal = a[sortConfig.key], bVal = b[sortConfig.key]
    if (sortConfig.key === 'contract_date') { aVal = new Date(aVal || 0); bVal = new Date(bVal || 0) }
    else if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase() }
    else if (sortConfig.key?.includes('amount')) { aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0 }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const clearAllFilters = () => { setFilters({ contract_no: '', project_name: '', customer_name: '', pm_name: '', status: '' }); setSortConfig({ key: null, direction: null }) }
  const handleSort = (key) => { setSortConfig(prev => { if (prev.key !== key) return { key, direction: 'asc' }; if (prev.direction === 'asc') return { key, direction: 'desc' }; return { key: null, direction: null } }) }
  const getSortIcon = (key) => { if (sortConfig.key !== key) return ''; if (sortConfig.direction === 'asc') return ' ↑'; return ' ↓' }
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || sortConfig.key !== null
  const formatCurrency = (value) => { if (value === null || value === undefined || isNaN(value)) return '-'; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) }
  const formatDate = (dateStr) => { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('vi-VN') }
  const getStatusBadge = (status) => { const config = { 'Active': { className: 'status-active', label: 'Đang thực hiện' }, 'Completed': { className: 'status-completed', label: 'Hoàn thành' }, 'Pending': { className: 'status-pending', label: 'Chờ xử lý' }, 'Cancelled': { className: 'status-cancelled', label: 'Hủy bỏ' } }[status] || { className: 'bg-gray-100 text-gray-800', label: status }; return <span className={`status-badge ${config.className}`}>{config.label}</span> }
  const getAvatarBadge = (name) => { if (!name) return <span className="text-gray-400">-</span>; const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3); return (<div className="pm-badge"><span className="pm-avatar">{initials}</span><span className="text-gray-700">{name}</span></div>) }

  const renderFilterDropdown = (columnKey, placeholder) => { const isOpen = openDropdown === columnKey; return (<span ref={isOpen ? currentDropdownRef : null} className="relative inline-block"><button onClick={() => setOpenDropdown(isOpen ? null : columnKey)} className="ml-1 text-gray-400 hover:text-tecapro-600 transition-colors">▼</button>{isOpen && (<div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3"><input type="text" placeholder={placeholder} value={filters[columnKey]} onChange={(e) => setFilters(prev => ({ ...prev, [columnKey]: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-tecapro-500 focus:border-tecapro-500 outline-none" autoFocus /><button onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: '' })); setOpenDropdown(null) }} className="mt-2 w-full text-xs text-tecapro-600 hover:text-tecapro-700 font-medium">Xóa lọc</button></div>)}</span>) }
  const renderSelectDropdown = (columnKey, options) => { const isOpen = openDropdown === columnKey; return (<span ref={isOpen ? currentDropdownRef : null} className="relative inline-block"><button onClick={() => setOpenDropdown(isOpen ? null : columnKey)} className="ml-1 text-gray-400 hover:text-tecapro-600 transition-colors">▼</button>{isOpen && (<div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-2"><button onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: '' })); setOpenDropdown(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-md ${!filters[columnKey] ? 'bg-tecapro-50 text-tecapro-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>Tất cả</button>{options.map(opt => (<button key={opt} onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: opt })); setOpenDropdown(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-md ${filters[columnKey] === opt ? 'bg-tecapro-50 text-tecapro-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{opt}</button>))}</div>)}</span>) }

  const stats = { total: localContracts.length, active: localContracts.filter(c => c.status === 'Active').length, completed: localContracts.filter(c => c.status === 'Completed').length, totalValue: localContracts.reduce((sum, c) => sum + (parseFloat(c.amount_after_vat) || 0), 0) }

  async function handleSaveContract(formData) {
    console.log('CREATE PAYLOAD', formData)

    try {
      const res = await fetch(`${getBaseUrl()}/api/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || data.message || 'Thêm hợp đồng thất bại!')
        return
      }

      alert('Tạo hợp đồng thành công!')
      setShowAddContractModal(false)
      if (onLoadContracts) onLoadContracts()
    } catch(error) {
      console.error('==========================')
      console.error('CREATE CONTRACT ERROR')
      console.error(error)

      if (error.response) {
        console.error('STATUS:', error.response.status)
        console.error('DATA:', error.response.data)
      }

      if (error.request) {
        console.error('REQUEST:', error.request)
      }

      console.error('==========================')

      throw error
    }
  }

  function getBaseUrl() {
    return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
  }

  return (
    <div className="p-6">
      {/* Header Page */}
      <div className="page-header">
        <h1 className="page-title">HỢP ĐỒNG BÁN</h1>
        <p className="page-subtitle">Quản lý danh sách hợp đồng đầu ra của công ty</p>
      </div>

      {/* Card Thống kê */}
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
          <p className="stat-value money">{formatCurrency(stats.totalValue)} ₫</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {isPM && (
          <button className="btn-primary" onClick={() => setShowAddContractModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm hợp đồng
          </button>
        )}
        <input
          type="text"
          placeholder="🔍 Tìm kiếm (Số HĐ, Tên dự án, Chủ đầu tư...)"
          value={localSearchTerm}
          onChange={(e) => { setLocalSearchTerm(e.target.value); window.dispatchEvent(new CustomEvent('contract-search-change', { detail: e.target.value })) }}
          className="search-input"
        />
      </div>

      {/* Active Filters Info */}
      {hasActiveFilters && (
        <div className="mb-4 flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Bộ lọc:</span>
            {Object.entries(filters).map(([key, value]) => value && (
              <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-tecapro-100 text-tecapro-700 rounded-md text-xs font-medium">
                {key === 'contract_no' ? 'Số HĐ' : key === 'project_name' ? 'Dự án' : key === 'customer_name' ? 'CĐT' : key === 'pm_name' ? 'PM' : 'Trạng thái'}: {value}
                <button onClick={() => setFilters(prev => ({ ...prev, [key]: '' }))} className="hover:text-tecapro-900">×</button>
              </span>
            ))}
            {sortConfig.key && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-tecapro-100 text-tecapro-700 rounded-md text-xs font-medium">
                Sort: {sortConfig.key} {sortConfig.direction === 'asc' ? '↑' : '↓'}
                <button onClick={() => setSortConfig({ key: null, direction: null })} className="hover:text-tecapro-900">×</button>
              </span>
            )}
          </div>
          <button onClick={clearAllFilters} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Xóa tất cả bộ lọc</button>
        </div>
      )}

      {/* Result Count */}
      <div className="mb-2 text-sm text-gray-500">
        Hiển thị: <span className="font-medium text-gray-700">{filteredAndSortedContracts.length}</span> / {localContracts.length} hợp đồng
      </div>

      {/* TABLE CARD - SCROLL CONTAINER */}
      <div className="table-container">
        <div className="table-wrapper">
          <table className="contract-table divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="sticky-col-1 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Quản trị</th>
                <th className="sticky-col-2 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 col-contract-no" onClick={() => handleSort('contract_no')}>
                  Số HĐ{getSortIcon('contract_no')}{renderFilterDropdown('contract_no', 'Tìm số HĐ')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100 col-project-name" onClick={() => handleSort('project_name')}>
                  Tên dự án{getSortIcon('project_name')}{renderFilterDropdown('project_name', 'Tìm dự án')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100 col-customer-name" onClick={() => handleSort('customer_name')}>
                  Chủ đầu tư{getSortIcon('customer_name')}{renderFilterDropdown('customer_name', 'Tìm CĐT')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100" onClick={() => handleSort('contract_date')}>
                  Ngày ký{getSortIcon('contract_date')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col col-tender-name">Gói thầu</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amount_before_vat')}>
                  Trước VAT{getSortIcon('amount_before_vat')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amount_after_vat')}>
                  Sau VAT{getSortIcon('amount_after_vat')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col">USD</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100 col-pm-name" onClick={() => handleSort('pm_name')}>
                  PM chính{getSortIcon('pm_name')}{renderSelectDropdown('pm_name', uniquePMs)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider sticky-col cursor-pointer hover:bg-gray-100 col-status" onClick={() => handleSort('status')}>
                  Trạng thái{getSortIcon('status')}{renderSelectDropdown('status', uniqueStatuses)}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 table-body">
              {filteredAndSortedContracts.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-12 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mt-2 text-sm">Không tìm thấy kết quả nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedContracts.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="sticky-col-1 px-4 py-3 whitespace-nowrap">
                      <button className="btn-manage" onClick={(e) => { e.stopPropagation(); console.log('Contract ID:', c.id); if (onManage) onManage(c) }} title="Quản trị">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                    </td>
                    <td className="sticky-col-2 px-4 py-3 whitespace-nowrap text-sm text-gray-900">{c.contract_no || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{c.project_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.customer_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(c.contract_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.tender_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium col-money">{formatCurrency(c.amount_before_vat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium col-money">{formatCurrency(c.amount_after_vat)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right col-money">{c.currency_code === 'USD' ? formatCurrency(c.amount_after_vat) : '-'}</td>
                    <td className="px-6 py-3 whitespace-nowrap">{getAvatarBadge(c.pm_name)}</td>
                    <td className="px-6 py-3 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm hợp đồng */}
      {showAddContractModal && (
        <ContractModal
          isOpen={showAddContractModal}
          onClose={() => setShowAddContractModal(false)}
          onSave={handleSaveContract}
          currentUser={currentUser}
          contracts={localContracts}
          users={users || []}
          customers={customers || []}
        />
      )}
    </div>
  )
}
