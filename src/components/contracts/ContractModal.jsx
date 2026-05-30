import { useState, useEffect, useRef } from 'react'

export default function ContractModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentUser,
  contracts = [],
  users = [],
  customers = []
}) {
  const [formData, setFormData] = useState({
    contract_no: '',
    contract_date: new Date().toISOString().split('T')[0],
    project_name: '',
    customer_id: '',
    tender_name: '',
    amount_before_vat: '',
    vat_percent: '10',
    amount_after_vat: '',
    currency_code: 'VND',
    terms: '',
    status: 'Pending',
    // Nhân sự
    sale_team: [],
    presale_team: [],
    technical_team: [],
    accounting_team: [],
    followers: []
  })

  const [errors, setErrors] = useState({
    contract_no: ''
  })

  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (isOpen && currentUser) {
      // Tự động gán PM chính là người tạo
      setFormData(prev => ({
        ...prev,
        pm_primary: currentUser.id
      }))
    }
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen, currentUser])

  function resetForm() {
    setFormData({
      contract_no: '',
      contract_date: new Date().toISOString().split('T')[0],
      project_name: '',
      customer_id: '',
      tender_name: '',
      amount_before_vat: '',
      vat_percent: '10',
      amount_after_vat: '',
      currency_code: 'VND',
      terms: '',
      status: 'Pending',
      sale_team: [],
      presale_team: [],
      technical_team: [],
      accounting_team: [],
      followers: []
    })
    setErrors({ contract_no: '' })
  }

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when typing contract_no
    if (field === 'contract_no') {
      setErrors(prev => ({ ...prev, contract_no: '' }))
    }

    // Auto calculate amount_after_vat
    if (field === 'amount_before_vat' || field === 'vat_percent') {
      const beforeVat = parseFloat(value) || 0
      const vatPercent = field === 'vat_percent' ? parseFloat(value) : parseFloat(formData.vat_percent) || 10
      const afterVat = beforeVat * (1 + vatPercent / 100)
      setFormData(prev => ({ ...prev, amount_after_vat: afterVat.toFixed(0) }))
    }
  }

  async function handleBlurContractNo(value) {
    if (!value || value.trim() === '') {
      return
    }

    console.log('Checking contract no:', value)

    setIsChecking(true)

    try {
      // Gọi API backend để kiểm tra trùng số hợp đồng
      const res = await fetch(`${getBaseUrl()}/api/contracts/check-contract-no`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_no: value })
      })

      console.log('API response status:', res.status)

      const data = await res.json()

      console.log('API data:', data)

      setIsChecking(false)
      setErrors(prev => ({
        ...prev,
        contract_no: data.exists ? 'Số hợp đồng đã tồn tại' : ''
      }))
    } catch (err) {
      console.error('Error checking contract no:', err)
      setIsChecking(false)
      setErrors(prev => ({
        ...prev,
        contract_no: 'Có lỗi khi kiểm tra số hợp đồng.'
      }))
    }
  }

  function getBaseUrl() {
    return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
  }

  function handleMultiSelectChange(group, selectedValues) {
    setFormData(prev => ({ ...prev, [group]: selectedValues }))
  }

  async function handleSubmit() {
    if (errors.contract_no) {
      alert('Vui lòng sửa lỗi trùng số hợp đồng trước khi lưu!')
      return
    }

    const requiredFields = ['contract_no', 'contract_date', 'project_name', 'customer_id']
    
    for (const field of requiredFields) {
      if (!formData[field]) {
        const fieldName = field === 'contract_no' ? 'số hợp đồng' 
          : field === 'contract_date' ? 'ngày ký'
          : field === 'project_name' ? 'tên dự án'
          : 'chủ đầu tư'
        alert(`Vui lòng nhập ${fieldName}!`)
        return
      }
    }

    // Chuẩn bị dữ liệu gửi đi
    const submitData = {
      ...formData,
      pm_primary_id: currentUser?.id,
      amount_before_vat: parseFloat(formData.amount_before_vat) || 0,
      amount_after_vat: parseFloat(formData.amount_after_vat) || 0,
      vat_percent: parseFloat(formData.vat_percent) || 0
    }

    await onSave(submitData)
  }

  if (!isOpen) return null

  const getUserName = (userId) => {
    const user = users.find(u => u.id === parseInt(userId))
    return user ? user.full_name : `ID: ${userId}`
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal contract-modal" style={{ width: '1000px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <h2>THÊM HỢP ĐỒNG MỚI</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Thông tin chung */}
          <div className="contract-form-section">
            <h3 className="contract-section-title">Thông tin chung</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Số hợp đồng *</label>
                <input
                  type="text"
                  value={formData.contract_no}
                  onChange={(e) => updateField('contract_no', e.target.value)}
                  onBlur={() => handleBlurContractNo(formData.contract_no)}
                  placeholder="VD: HD-2026-001"
                  className={errors.contract_no ? 'error' : ''}
                />
                {errors.contract_no && <p className="error-text">{errors.contract_no}</p>}
                {isChecking && <p className="loading-text">Đang kiểm tra...</p>}
              </div>
              <div className="form-group">
                <label>Ngày ký *</label>
                <input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => updateField('contract_date', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Tên dự án *</label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => updateField('project_name', e.target.value)}
                  placeholder="Nhập tên dự án"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Chủ đầu tư *</label>
                <CustomerSelect
                  customers={customers}
                  selectedId={formData.customer_id}
                  onChange={(id) => updateField('customer_id', id)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Tên gói thầu</label>
                <input
                  type="text"
                  value={formData.tender_name}
                  onChange={(e) => updateField('tender_name', e.target.value)}
                  placeholder="Nhập tên gói thầu"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Trước VAT</label>
                <input
                  type="number"
                  value={formData.amount_before_vat}
                  onChange={(e) => updateField('amount_before_vat', e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>VAT (%)</label>
                <input
                  type="number"
                  value={formData.vat_percent}
                  onChange={(e) => updateField('vat_percent', e.target.value)}
                  min="0"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label>Sau VAT</label>
                <input
                  type="text"
                  value={formData.amount_after_vat}
                  readOnly
                  placeholder="Tự động tính"
                  className="readonly-field"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Đơn vị tiền tệ</label>
                <select
                  value={formData.currency_code}
                  onChange={(e) => updateField('currency_code', e.target.value)}
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="form-group">
                <label>Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="Pending">Chờ xử lý</option>
                  <option value="Active">Đang thực hiện</option>
                  <option value="Completed">Hoàn thành</option>
                  <option value="Cancelled">Hủy bỏ</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Điều khoản</label>
                <textarea
                  rows="4"
                  value={formData.terms}
                  onChange={(e) => updateField('terms', e.target.value)}
                  placeholder="Nhập điều khoản hợp đồng..."
                />
              </div>
            </div>
          </div>

          {/* Thông tin nhân sự */}
          <div className="contract-form-section">
            <h3 className="contract-section-title">Thông tin nhân sự</h3>
            
            <div className="form-row">
              <div className="form-group full-width">
                <label>PM chính</label>
                <input
                  type="text"
                  value={currentUser?.full_name || ''}
                  readOnly
                  className="readonly-field"
                />
              </div>
            </div>

            {/* Sale Team */}
            <div className="form-row">
              <div className="form-group full-width">
                <label>Nhân viên kinh doanh (Sale)</label>
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.sale_team}
                  onChange={(selected) => handleMultiSelectChange('sale_team', selected)}
                  placeholder="Chọn nhân viên kinh doanh..."
                />
              </div>
            </div>

            {/* Presale Team */}
            <div className="form-row">
              <div className="form-group full-width">
                <label>Presale</label>
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.presale_team}
                  onChange={(selected) => handleMultiSelectChange('presale_team', selected)}
                  placeholder="Chọn presale..."
                />
              </div>
            </div>

            {/* Technical Team */}
            <div className="form-row">
              <div className="form-group full-width">
                <label>Kỹ thuật triển khai</label>
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.technical_team}
                  onChange={(selected) => handleMultiSelectChange('technical_team', selected)}
                  placeholder="Chọn kỹ thuật..."
                />
              </div>
            </div>

            {/* Accounting Team */}
            <div className="form-row">
              <div className="form-group full-width">
                <label>Kế toán</label>
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.accounting_team}
                  onChange={(selected) => handleMultiSelectChange('accounting_team', selected)}
                  placeholder="Chọn kế toán..."
                />
              </div>
            </div>

            {/* Followers */}
            <div className="form-row">
              <div className="form-group full-width">
                <label>Người theo dõi</label>
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.followers}
                  onChange={(selected) => handleMultiSelectChange('followers', selected)}
                  placeholder="Chọn người theo dõi..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={() => { onClose(); resetForm() }}>
            Hủy
          </button>
          <button
            className="save-btn"
            disabled={!!errors.contract_no || !formData.contract_no || !formData.contract_date || !formData.project_name || !formData.customer_id}
            onClick={handleSubmit}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

// Multi-select component
function MultiSelect({ options, selectedValues, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function toggleOption(value) {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
  }

  function removeOption(value, e) {
    e.stopPropagation()
    onChange(selectedValues.filter(v => v !== value))
  }

  return (
    <div className="multi-select-container" style={{ position: 'relative' }}>
      <div 
        className="multi-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          minHeight: '40px',
          cursor: 'pointer',
          backgroundColor: '#fff'
        }}
      >
        {selectedValues.length === 0 && (
          <span style={{ color: '#9ca3af' }}>{placeholder}</span>
        )}
        {selectedValues.map(value => {
          const option = options.find(o => o.value === value)
          return option ? (
            <span 
              key={value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            >
              {option.label}
              <button 
                onClick={(e) => removeOption(value, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0',
                  color: '#1e40af',
                  fontSize: '14px'
                }}
              >
                ×
              </button>
            </span>
          ) : null
        })}
      </div>

      {isOpen && (
        <>
          <div 
            className="multi-select-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #e5e7eb',
                outline: 'none'
              }}
            />
            {filteredOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: selectedValues.includes(opt.value) ? '#dbeafe' : 'transparent',
                  color: selectedValues.includes(opt.value) ? '#1e40af' : '#374151'
                }}
              >
                {selectedValues.includes(opt.value) && '✓ '}{opt.label}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '8px 12px', color: '#9ca3af' }}>Không tìm thấy</div>
            )}
          </div>
          <div 
            className="multi-select-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99
            }}
          />
        </>
      )}
    </div>
  )
}

// Customer Select Component with Search
function CustomerSelect({ customers, selectedId, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter customers by code or name
  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase()
    return (c.code && c.code.toLowerCase().includes(term)) || (c.name && c.name.toLowerCase().includes(term))
  })

  // Get selected customer name - handle both string and number IDs
  const selectedCustomer = customers.find(c => {
    if (!selectedId) return false
    return c.id === parseInt(selectedId) || c.id === selectedId || String(c.id) === String(selectedId)
  })
  const displayValue = selectedCustomer ? selectedCustomer.name : ''

  // Handle customer selection
  const handleSelect = (id) => {
    onChange(id)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="customer-select-container" style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Display area */}
      <div 
        className="customer-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          minHeight: '40px',
          cursor: 'pointer',
          backgroundColor: '#fff'
        }}
      >
        <span style={{ color: displayValue ? '#374151' : '#9ca3af' }}>
          {displayValue || 'Chọn chủ đầu tư...'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {selectedId && (
            <button 
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 4px',
                color: '#6b7280',
                fontSize: '16px'
              }}
            >
              ×
            </button>
          )}
          <span style={{ color: '#9ca3af' }}>▼</span>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #e5e7eb',
                outline: 'none'
              }}
            />
            {filteredCustomers.map(c => {
              const isSelected = String(c.id) === String(selectedId)
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#dbeafe' : 'transparent',
                    color: isSelected ? '#1e40af' : '#374151'
                  }}
                >
                  {isSelected && '✓ '}{c.name} {c.code && `(${c.code})`}
                </div>
              )
            })}
            {filteredCustomers.length === 0 && (
              <div style={{ padding: '8px 12px', color: '#9ca3af' }}>Không tìm thấy</div>
            )}
          </div>
          <div 
            className="customer-select-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99
            }}
          />
        </>
      )}
    </div>
  )
}
