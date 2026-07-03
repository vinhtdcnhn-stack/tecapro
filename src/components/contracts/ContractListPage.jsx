import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../../config/api'
import { prefetchContract } from '../../lib/idlePrefetch'
import ContractModal from './ContractModal'
import ColumnSettingsPanel from './ColumnSettingsPanel'
import DateInput from './DateInput'
import useIsMobile from './useIsMobile'
import { usePermission } from '../../hooks/usePermission'
import { LOCKED_COLUMNS, MOVABLE_COLUMN_KEYS, COLUMNS_BY_KEY } from './contractListColumns'
import { useColumnPrefs } from './useColumnPrefs'
import { useContractListNav } from './useContractListNav'

// Mặc định lọc theo ngày ký: từ 1/1 đến 31/12 năm hiện tại
const currentYear = new Date().getFullYear()
const defaultDateFrom = `${currentYear}-01-01`
const defaultDateTo = `${currentYear}-12-31`

// Ghi nhớ khung thời gian đã chọn để lần sau vào trang không phải đặt lại
const DATE_RANGE_KEY = 'contractList.dateRange'
const loadSavedRange = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DATE_RANGE_KEY) || '{}')
    return { from: saved.from ?? defaultDateFrom, to: saved.to ?? defaultDateTo }
  } catch { return { from: defaultDateFrom, to: defaultDateTo } }
}

export default function ContractListPage({ contracts, searchTerm: parentSearchTerm, onManage, onLoadContracts, currentUser, users, customers }) {
  const savedRange = loadSavedRange()
  const [localContracts, setLocalContracts] = useState([])
  const [localSearchTerm, setLocalSearchTerm] = useState(parentSearchTerm || '')
  const [dateFrom, setDateFrom] = useState(savedRange.from)
  const [dateTo, setDateTo] = useState(savedRange.to)
  const [filters, setFilters] = useState({ contract_no: '', project_name: '', customer_name: '', pm_name: '', status: '' })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null })
  const [openDropdown, setOpenDropdown] = useState(null)
  // Hàng đang được chọn bằng bàn phím (↑/↓); Space để mở chi tiết
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const currentDropdownRef = useRef(null)
  const tableWrapperRef = useRef(null)
  const selectedRowRef = useRef(null)
  const dragScroll = useRef({ active: false, moved: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })
  
  // Modal state for adding contract
  const [showAddContractModal, setShowAddContractModal] = useState(false)

  // Tùy chỉnh cột: thứ tự + ẩn/hiện (lưu localStorage), panel ⚙, kéo thả trên header
  const { order: columnOrder, hidden: hiddenColumns, toggleColumn, moveColumn, resetColumns } = useColumnPrefs(MOVABLE_COLUMN_KEYS)
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const dragColKey = useRef(null)
  const [dragOverColKey, setDragOverColKey] = useState(null)

  const isMobile = useIsMobile()
  const { has } = usePermission()
  // Xem cột tiền (Trước VAT / Sau VAT / USD + card Tổng giá trị). Thiếu quyền → ẩn hết cột tiền.
  // Backend cũng strip số tiền cho user thiếu quyền nên đây chỉ là ẩn hiển thị.
  const canSeeAmounts = has('module.contracts.amounts')
  const isPM = currentUser?.positions?.some(p => p.code === 'PM_TEAM')
           || currentUser?.position_code === 'PM_TEAM'

  // Tỏ ý sắp mở 1 HĐ (rê chuột/chạm): nạp sẵn DỮ LIỆU chi tiết + CHUNK trang chi tiết
  // → khi bấm vào gần như mở tức thì. import() được module-cache nên gọi lại vô hại.
  const prefetchDetail = (id) => { prefetchContract(id); import('../../pages/QldaDetailPage') }
  
  // Danh sách HĐ do QldaPage cấp qua TanStack Query (tự nạp + cache); không cần tự tải lúc mount.
  // onLoadContracts giờ chỉ dùng để làm mới sau khi thêm/sửa HĐ.
  useEffect(() => { try { localStorage.setItem(DATE_RANGE_KEY, JSON.stringify({ from: dateFrom, to: dateTo })) } catch { /* ignore */ } }, [dateFrom, dateTo])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ state nội bộ từ prop (để lọc/sửa cục bộ) khi prop đổi
  useEffect(() => { setLocalContracts(contracts || []) }, [contracts])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ state nội bộ từ prop khi prop đổi
  useEffect(() => { setLocalSearchTerm(parentSearchTerm || '') }, [parentSearchTerm])
  useEffect(() => { function handleClickOutside(event) { if (currentDropdownRef.current && !currentDropdownRef.current.contains(event.target)) setOpenDropdown(null) } document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside) }, [])

  // Lọc theo khoảng ngày ký (so sánh trên phần yyyy-mm-dd để tránh lệch múi giờ)
  const dateFilteredContracts = localContracts.filter(c => {
    if (!dateFrom && !dateTo) return true
    const d = c.contract_date ? String(c.contract_date).slice(0, 10) : ''
    if (!d) return false
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  const uniquePMs = [...new Set(dateFilteredContracts.map(c => c.pm_name).filter(Boolean))]
  const uniqueStatuses = [...new Set(dateFilteredContracts.map(c => c.status).filter(Boolean))]

  const filteredAndSortedContracts = dateFilteredContracts.filter(c => {
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

  // Điều hướng bàn phím (↑/↓, Space, Alt+C/P) + cuộn hàng đang chọn vào tầm nhìn
  useContractListNav({ isMobile, list: filteredAndSortedContracts, selectedIndex, setSelectedIndex, setFilters, onManage, selectedRowRef })

  const clearAllFilters = () => { setFilters({ contract_no: '', project_name: '', customer_name: '', pm_name: '', status: '' }); setSortConfig({ key: null, direction: null }) }
  const handleSort = (key) => { setSortConfig(prev => { if (prev.key !== key) return { key, direction: 'asc' }; if (prev.direction === 'asc') return { key, direction: 'desc' }; return { key: null, direction: null } }) }
  const getSortIcon = (key) => { if (sortConfig.key !== key) return ''; if (sortConfig.direction === 'asc') return ' ↑'; return ' ↓' }
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || sortConfig.key !== null
  // Convert a contract's native amount to VND for display: USD contracts are multiplied by exchange_rate, VND contracts shown as-is
  const toVnd = (value, c) => { const num = parseFloat(value); if (isNaN(num)) return null; if (c.currency_code === 'USD') return Math.round(num * (parseFloat(c.exchange_rate) || 0)); return num }
  const formatCurrency = (value) => { if (value === null || value === undefined || isNaN(value)) return '-'; const num = Number(value); return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
  const formatDate = (dateStr) => { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('vi-VN') }
  const getStatusBadge = (status) => { const config = { 'Active': { className: 'status-active', label: 'Đang thực hiện' }, 'Completed': { className: 'status-completed', label: 'Hoàn thành' }, 'Pending': { className: 'status-pending', label: 'Chờ xử lý' }, 'Cancelled': { className: 'status-cancelled', label: 'Hủy bỏ' } }[status] || { className: 'bg-gray-100 text-gray-800', label: status }; return <span className={`status-badge ${config.className}`}>{config.label}</span> }
  const getAvatarBadge = (name) => { if (!name) return <span className="text-gray-400">-</span>; const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3); return (<div className="pm-badge"><span className="pm-avatar">{initials}</span><span className="text-gray-700">{name}</span></div>) }

  const renderFilterDropdown = (columnKey, placeholder) => { const isOpen = openDropdown === columnKey; return (<span ref={isOpen ? currentDropdownRef : null} className="relative inline-block"><button onClick={() => setOpenDropdown(isOpen ? null : columnKey)} className="ml-1 text-gray-400 hover:text-tecapro-600 transition-colors">▼</button>{isOpen && (<div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3"><input type="text" placeholder={placeholder} value={filters[columnKey]} onChange={(e) => setFilters(prev => ({ ...prev, [columnKey]: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-tecapro-500 focus:border-tecapro-500 outline-none" autoFocus /><button onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: '' })); setOpenDropdown(null) }} className="mt-2 w-full text-xs text-tecapro-600 hover:text-tecapro-700 font-medium">Xóa lọc</button></div>)}</span>) }
  const renderSelectDropdown = (columnKey, options) => { const isOpen = openDropdown === columnKey; return (<span ref={isOpen ? currentDropdownRef : null} className="relative inline-block"><button onClick={() => setOpenDropdown(isOpen ? null : columnKey)} className="ml-1 text-gray-400 hover:text-tecapro-600 transition-colors">▼</button>{isOpen && (<div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-2"><button onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: '' })); setOpenDropdown(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-md ${!filters[columnKey] ? 'bg-tecapro-50 text-tecapro-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>Tất cả</button>{options.map(opt => (<button key={opt} onClick={() => { setFilters(prev => ({ ...prev, [columnKey]: opt })); setOpenDropdown(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-md ${filters[columnKey] === opt ? 'bg-tecapro-50 text-tecapro-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{opt}</button>))}</div>)}</span>) }

  const stats = { total: dateFilteredContracts.length, active: dateFilteredContracts.filter(c => c.status === 'Active').length, completed: dateFilteredContracts.filter(c => c.status === 'Completed').length, totalValue: dateFilteredContracts.reduce((sum, c) => sum + (toVnd(c.amount_after_vat, c) || 0), 0) }

  // Ẩn cột tiền nếu thiếu quyền, dù cấu hình đã lưu có bật.
  const isColumnAllowed = (col) => !col.gated || (col.gated === 'amounts' && canSeeAmounts)
  // Cột hiển thị = cột dính cố định + cột movable (theo thứ tự đã lưu, bỏ cột ẩn / không có quyền)
  const orderedMovable = columnOrder.map(k => COLUMNS_BY_KEY[k]).filter(Boolean)
  const visibleColumns = [
    ...LOCKED_COLUMNS,
    ...orderedMovable.filter(col => isColumnAllowed(col) && !hiddenColumns.includes(col.key)),
  ]
  // Danh sách cột cho panel ⚙ (chỉ movable + được phép xem), theo đúng thứ tự hiện tại
  const panelColumns = orderedMovable.filter(isColumnAllowed).map(col => ({ key: col.key, label: col.label }))
  // Ngữ cảnh render ô: cấp các hàm format/helper cho renderCell của mỗi cột
  const cellCtx = { onManage, formatDate, formatCurrency, toVnd, getAvatarBadge, getStatusBadge }

  // Nội dung header 1 cột: nhãn + icon sort + dropdown lọc (nếu có)
  const renderHeaderContent = (col) => (<>
    {col.label}{col.sortable ? getSortIcon(col.key) : ''}
    {col.filter?.type === 'text' && renderFilterDropdown(col.key, col.filter.placeholder)}
    {col.filter?.type === 'select' && renderSelectDropdown(col.key, col.filter.optionsKey === 'pm_name' ? uniquePMs : uniqueStatuses)}
  </>)

  async function handleSaveContract(formData) {
    try {
      const res = await fetch(`${API_BASE}/api/contracts`, {
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

  

  return (
    <div className="contract-list-root">
      {/* Header Page */}
      <div className="page-header">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title" style={{ margin: 0 }}>HỢP ĐỒNG BÁN</h1>
          {isMobile && isPM && (
            <button className="btn-primary clp-add-icon" onClick={() => setShowAddContractModal(true)}
              title="Thêm hợp đồng" aria-label="Thêm hợp đồng">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>
        {!isMobile && <p className="page-subtitle">Quản lý danh sách hợp đồng đầu ra của công ty</p>}
      </div>

      {/* Card Thống kê — ẩn trên mobile */}
      {!isMobile && (
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
        {canSeeAmounts && (
        <div className="stat-card">
          <p className="stat-label">Tổng giá trị</p>
          <p className="stat-value money">{formatCurrency(stats.totalValue)} ₫</p>
        </div>
        )}
      </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {isPM && !isMobile && (
          <button className="btn-primary" onClick={() => setShowAddContractModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm hợp đồng
          </button>
        )}

        {/* Lọc theo ngày ký — mobile dùng icon thay nhãn chữ */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isMobile ? (
            <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Ngày ký từ"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          ) : (
            <span className="text-sm text-gray-600 whitespace-nowrap">Ngày ký từ:</span>
          )}
          <DateInput value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 130 }} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
          {isMobile ? (
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="đến"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          ) : (
            <span className="text-sm text-gray-600">đến</span>
          )}
          <DateInput value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 130 }} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
          {(dateFrom !== defaultDateFrom || dateTo !== defaultDateTo) && (
            <button onClick={() => { setDateFrom(defaultDateFrom); setDateTo(defaultDateTo) }} className="text-base text-tecapro-600 hover:text-tecapro-700 leading-none px-1" title="Đặt lại về năm hiện tại (1/1 – 31/12)">↺</button>
          )}
        </div>

        <input
          type="text"
          placeholder="🔍 Tìm kiếm (Số HĐ, Tên dự án, Chủ đầu tư...)"
          value={localSearchTerm}
          onChange={(e) => { setLocalSearchTerm(e.target.value); window.dispatchEvent(new CustomEvent('contract-search-change', { detail: e.target.value })) }}
          className="search-input ml-auto shrink-0"
        />

        {/* Tùy chỉnh cột (chỉ desktop — mobile dùng danh sách thẻ) */}
        {!isMobile && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowColumnPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50"
              title="Tùy chỉnh cột hiển thị"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" /></svg>
              Cột
            </button>
            {showColumnPanel && (
              <ColumnSettingsPanel
                columns={panelColumns}
                hidden={hiddenColumns}
                onToggle={toggleColumn}
                onMove={moveColumn}
                onReset={resetColumns}
                onClose={() => setShowColumnPanel(false)}
              />
            )}
          </div>
        )}
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

      {/* Result Count — ẩn trên mobile */}
      {!isMobile && (
      <div className="mb-2 text-sm text-gray-500">
        Hiển thị: <span className="font-medium text-gray-700">{filteredAndSortedContracts.length}</span> / {dateFilteredContracts.length} hợp đồng
      </div>
      )}

      {/* Mobile: danh sách thẻ */}
      {isMobile ? (
        <div className="clp-card-list">
          {filteredAndSortedContracts.length === 0 ? (
            <div className="clp-card-empty">Không tìm thấy kết quả nào phù hợp.</div>
          ) : filteredAndSortedContracts.map((c) => {
            const jv = !!c.is_joint_venture
            return (
              <button key={c.id} type="button" className="clp-card" style={jv ? { background: '#fff7ed' } : undefined}
                onTouchStart={() => prefetchDetail(c.id)}
                onClick={() => onManage && onManage(c)}>
                <div className="clp-card-top">
                  <span className="clp-card-no">
                    {c.contract_no || '-'}
                    {jv && <span className="clp-card-jv">Liên danh</span>}
                  </span>
                  {getStatusBadge(c.status)}
                </div>
                {c.project_name && <div className="clp-card-project">{c.project_name}</div>}
                <div className="clp-card-rows">
                  <div><span>Chủ đầu tư</span><span>{c.customer_name || '-'}</span></div>
                  <div><span>Ngày ký</span><span>{formatDate(c.contract_date)}</span></div>
                  <div><span>PM chính</span><span>{c.pm_name || '-'}</span></div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
      /* TABLE CARD - SCROLL CONTAINER */
      <div className="table-container">
        <div
          className="table-wrapper"
          ref={tableWrapperRef}
          onMouseDown={e => {
            if (e.button !== 0) return
            const el = tableWrapperRef.current
            dragScroll.current = { active: true, moved: false, startX: e.pageX, startY: e.pageY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
            el.style.cursor = 'grabbing'
            el.style.userSelect = 'none'
          }}
          onMouseMove={e => {
            const ds = dragScroll.current
            if (!ds.active) return
            // Đánh dấu là đã kéo (để phân biệt với click mở hợp đồng)
            if (Math.abs(e.pageX - ds.startX) > 4 || Math.abs(e.pageY - ds.startY) > 4) ds.moved = true
            const el = tableWrapperRef.current
            el.scrollLeft = ds.scrollLeft - (e.pageX - ds.startX)
            el.scrollTop  = ds.scrollTop  - (e.pageY - ds.startY)
          }}
          onMouseUp={() => {
            dragScroll.current.active = false
            const el = tableWrapperRef.current
            el.style.cursor = ''
            el.style.userSelect = ''
          }}
          onMouseLeave={() => {
            dragScroll.current.active = false
            const el = tableWrapperRef.current
            el.style.cursor = ''
            el.style.userSelect = ''
          }}
        >
          <table className="contract-table divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                {visibleColumns.map(col => {
                  const draggable = !col.locked
                  const isOver = dragOverColKey === col.key
                  return (
                    <th
                      key={col.key}
                      className={col.thClass}
                      style={isOver ? { boxShadow: 'inset 3px 0 0 0 #34d399' } : undefined}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      draggable={draggable || undefined}
                      onMouseDown={draggable ? (e => e.stopPropagation()) : undefined}
                      onDragStart={draggable ? (() => { dragColKey.current = col.key }) : undefined}
                      onDragOver={draggable ? (e => { e.preventDefault(); if (dragOverColKey !== col.key) setDragOverColKey(col.key) }) : undefined}
                      onDragLeave={draggable ? (() => setDragOverColKey(prev => (prev === col.key ? null : prev))) : undefined}
                      onDrop={draggable ? (() => { if (dragColKey.current) moveColumn(dragColKey.current, col.key); dragColKey.current = null; setDragOverColKey(null) }) : undefined}
                      onDragEnd={draggable ? (() => { dragColKey.current = null; setDragOverColKey(null) }) : undefined}
                      title={draggable ? 'Kéo để đổi thứ tự cột' : undefined}
                    >
                      {renderHeaderContent(col)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 table-body">
              {filteredAndSortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mt-2 text-sm">Không tìm thấy kết quả nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedContracts.map((c, idx) => {
                  const jv = !!c.is_joint_venture
                  const isSelected = idx === selectedIndex
                  // HĐ liên danh: tô nền cam nhạt để phân biệt (ghi đè cả nền trắng của cột dính)
                  // Hàng đang chọn bằng bàn phím: tô nền xanh nhạt (ưu tiên hơn nền liên danh)
                  const rowBg = isSelected ? { background: '#dbeafe' } : (jv ? { background: '#fff7ed' } : undefined)
                  const jvBg = rowBg
                  return (
                  <tr
                    key={c.id}
                    ref={isSelected ? selectedRowRef : null}
                    className={`table-row${isSelected ? ' contract-row-selected' : ''}`}
                    style={jvBg}
                    onMouseEnter={() => prefetchDetail(c.id)}
                    onClick={() => {
                      // Bỏ qua nếu vừa kéo để cuộn bảng (không coi là click mở HĐ)
                      if (dragScroll.current.moved) return
                      setSelectedIndex(idx)
                      if (onManage) onManage(c)
                    }}
                  >
                    {visibleColumns.map(col => (
                      <td key={col.key} className={col.tdClass} style={col.applyRowBgStyle ? jvBg : undefined}>
                        {col.renderCell(c, cellCtx)}
                      </td>
                    ))}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

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
