import { useState, useEffect } from 'react'
import { API_BASE } from '../../config/api'
import MultiSelect from '../common/MultiSelect'
import CustomerSelect from '../common/CustomerSelect'

export default function ContractModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentUser,
  users = [],
  customers = [],
  editMode = false,
  editData = null
}) {
  const [formData, setFormData] = useState({
    contract_no: '',
    contract_date: new Date().toISOString().split('T')[0],
    project_name: '',
    customer_id: '',
    tender_name: '',
    amount_before_vat: '',
    amount_after_vat: '',
    currency_code: 'VND',
    exchange_rate: '',
    terms: '',
    status: 'Pending',
    // Nhân sự
    sale_team: [],
    presale_team: [],
    technical_team: [],
    accounting_team: [],
    followers: [],
    pm_team: []
  })

  const [errors, setErrors] = useState({
    contract_no: ''
  })

  const [isChecking, setIsChecking] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editMode && editData) {
        // Load existing contract data for editing
        setFormData({
          contract_no: editData.contract_no || '',
          contract_date: editData.contract_date ? editData.contract_date.split('T')[0] : new Date().toISOString().split('T')[0],
          project_name: editData.project_name || '',
          customer_id: editData.customer_id || '',
          tender_name: editData.tender_name || '',
          amount_before_vat: editData.amount_before_vat || '',
          amount_after_vat: editData.amount_after_vat || '',
          currency_code: editData.currency_code || 'VND',
          exchange_rate: editData.exchange_rate || '',
          terms: editData.terms || '',
          status: editData.status || 'Pending',
          sale_team: editData.sale_member_ids || [],
          presale_team: editData.presale_member_ids || [],
          technical_team: editData.technical_member_ids || [],
          accounting_team: editData.accounting_member_ids || [],
          followers: editData.follower_member_ids || [],
          pm_team: editData.pm_primary_id
            ? [editData.pm_primary_id, ...(editData.pm_member_ids || []).filter(id => String(id) !== String(editData.pm_primary_id))]
            : (editData.pm_member_ids || [])
        })
      } else if (currentUser) {
        setFormData(prev => ({
          ...prev,
          pm_team: [currentUser.id]
        }))
      }
    }
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen, currentUser, editMode, editData])

  function resetForm() {
    setFormData({
      contract_no: '',
      contract_date: new Date().toISOString().split('T')[0],
      project_name: '',
      customer_id: '',
      tender_name: '',
      amount_before_vat: '',
      amount_after_vat: '',
      currency_code: 'VND',
      exchange_rate: '',
      terms: '',
      status: 'Pending',
      sale_team: [],
      presale_team: [],
      technical_team: [],
      accounting_team: [],
      followers: [],
      pm_team: []
    })
    setErrors({ contract_no: '' })
    setIsChecking(false)
    setIsDuplicate(false)
  }

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when typing contract_no
    if (field === 'contract_no') {
      setErrors(prev => ({ ...prev, contract_no: '' }))
      setIsDuplicate(false)
    }
  }

  async function handleBlurContractNo(value) {
    if (!value || value.trim() === '') {
      return
    }

    setIsChecking(true)
    setIsDuplicate(false)

    try {
      // Gọi API backend để kiểm tra trùng số hợp đồng
      const res = await fetch(`${API_BASE}/api/contracts/check-contract-no`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_no: value })
      })

      const data = await res.json()

      const duplicate = data.exists === true
      setIsDuplicate(duplicate)

      if (duplicate) {
        setErrors(prev => ({
          ...prev,
          contract_no: 'Số hợp đồng đã tồn tại'
        }))
      } else {
        setErrors(prev => ({
          ...prev,
          contract_no: ''
        }))
      }
    } catch (err) {
      console.error('Error checking contract no:', err)
      setErrors(prev => ({
        ...prev,
        contract_no: '⚠ Không kiểm tra được số hợp đồng'
      }))
      setIsDuplicate(false)
    } finally {
      setIsChecking(false)
    }
  }

  

  function handleMultiSelectChange(group, selectedValues) {
    setFormData(prev => ({ ...prev, [group]: selectedValues }))
  }

  async function handleSubmit() {
    if (errors.contract_no || isDuplicate) {
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

    if (formData.currency_code !== 'VND' && !(parseFloat(formData.exchange_rate) > 1)) {
      alert(`Vui lòng nhập tỷ giá quy đổi VNĐ khi chọn đồng tiền ${formData.currency_code}!`)
      return
    }

    // Chuẩn bị dữ liệu gửi đi
    const submitData = {
      ...formData,
      pm_primary_id: formData.pm_team[0] || currentUser?.id,
      pm_team: formData.pm_team,
      amount_before_vat: parseFloat(formData.amount_before_vat) || 0,
      amount_after_vat: parseFloat(formData.amount_after_vat) || 0,
      exchange_rate: parseFloat(formData.exchange_rate) || null
    }

    await onSave(submitData)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal contract-modal" style={{ width: '1000px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <h2>{editMode ? 'CẬP NHẬT THÔNG TIN HỢP ĐỒNG' : 'THÊM HỢP ĐỒNG MỚI'}</h2>
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
                {isChecking && <p className="loading-text">Đang kiểm tra...</p>}
                {isDuplicate && !isChecking && (
                  <p className="error-text" style={{ color: '#dc2626' }}>❌ Số hợp đồng đã tồn tại</p>
                )}
                {!isDuplicate && errors.contract_no && !isChecking && (
                  <p className="error-text">{errors.contract_no}</p>
                )}
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
              <div className="form-group" style={{ flex: 1 }}>
                <label>Giá trị hợp đồng trước VAT</label>
                <input
                  type="number"
                  value={formData.amount_before_vat}
                  onChange={(e) => updateField('amount_before_vat', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Giá trị hợp đồng sau VAT</label>
                <input
                  type="number"
                  value={formData.amount_after_vat}
                  onChange={(e) => updateField('amount_after_vat', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Đơn vị tiền tệ</label>
                <select
                  value={formData.currency_code}
                  onChange={(e) => updateField('currency_code', e.target.value)}
                  disabled={editMode}
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  Tỷ giá
                  {formData.currency_code !== 'VND' && !editMode && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
                <input
                  type="number"
                  value={formData.exchange_rate}
                  onChange={(e) => updateField('exchange_rate', e.target.value)}
                  placeholder={formData.currency_code === 'VND' ? '1' : 'Bắt buộc!'}
                  min="0"
                  step="0.0001"
                  disabled={editMode || formData.currency_code === 'VND'}
                  style={!editMode && formData.currency_code !== 'VND' && !(parseFloat(formData.exchange_rate) > 1)
                    ? { borderColor: '#f97316', background: '#fff7ed' }
                    : {}}
                />
                {!editMode && formData.currency_code !== 'VND' && !(parseFloat(formData.exchange_rate) > 1) && (
                  <p style={{ color: '#ea580c', fontSize: '12px', margin: '2px 0 0' }}>
                    Nhập tỷ giá VNĐ/{formData.currency_code}
                  </p>
                )}
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
                <MultiSelect
                  options={users.map(u => ({ value: u.id, label: u.full_name }))}
                  selectedValues={formData.pm_team}
                  onChange={(selected) => setFormData(prev => ({ ...prev, pm_team: selected }))}
                  placeholder="Chọn PM (người đầu tiên là PM chính)..."
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
            disabled={
              isDuplicate || !!errors.contract_no ||
              !formData.contract_no || !formData.contract_date || !formData.project_name || !formData.customer_id ||
              (formData.currency_code !== 'VND' && !(parseFloat(formData.exchange_rate) > 1))
            }
            onClick={handleSubmit}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}
