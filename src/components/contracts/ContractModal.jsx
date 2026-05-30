import { useState, useEffect } from 'react'

export default function ContractModal({ 
  isOpen, 
  onClose, 
  onSave, 
  contract = null,
  customers = []
}) {
  const isEdit = !!contract
  
  const [formData, setFormData] = useState({
    contract_no: '',
    contract_date: '',
    pakd_no: '',
    uq_no: '',
    customer_id: '',
    tender_name: '',
    project_name: '',
    contract_type: '',
    currency_code: 'VND',
    exchange_rate: 1,
    amount_before_vat: '',
    amount_after_vat: '',
    payment_term: '',
    status: '',
    members: []
  })

  useEffect(() => {
    if (contract) {
      setFormData({
        contract_no: contract.contract_no || '',
        contract_date: contract.contract_date ? contract.contract_date.split('T')[0] : '',
        pakd_no: contract.pakd_no || '',
        uq_no: contract.uq_no || '',
        customer_id: contract.customer_id || '',
        tender_name: contract.tender_name || '',
        project_name: contract.project_name || '',
        contract_type: contract.contract_type || '',
        currency_code: contract.currency_code || 'VND',
        exchange_rate: contract.exchange_rate || 1,
        amount_before_vat: contract.amount_before_vat || '',
        amount_after_vat: contract.amount_after_vat || '',
        payment_term: contract.payment_term || '',
        status: contract.status || '',
        members: contract.members || []
      })
    } else {
      resetForm()
    }
  }, [contract, isOpen])

  function resetForm() {
    setFormData({
      contract_no: '',
      contract_date: '',
      pakd_no: '',
      uq_no: '',
      customer_id: '',
      tender_name: '',
      project_name: '',
      contract_type: '',
      currency_code: 'VND',
      exchange_rate: 1,
      amount_before_vat: '',
      amount_after_vat: '',
      payment_term: '',
      status: '',
      members: []
    })
  }

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    // Validate required fields
    if (!formData.contract_no || !formData.project_name) {
      alert('Vui lòng nhập số hợp đồng và tên dự án!')
      return
    }

    await onSave(formData, isEdit)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '1000px' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'SỬA HỢP ĐỒNG' : 'THÊM HỢP ĐỒNG'}</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }}>✕</button>
        </div>

        <div className="modal-body" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="field">
            <label>Số hợp đồng <span style={{color: 'red'}}>*</span></label>
            <input
              type="text"
              value={formData.contract_no}
              onChange={(e) => updateField('contract_no', e.target.value)}
              placeholder="Nhập số hợp đồng"
            />
          </div>

          <div className="field">
            <label>Tên dự án <span style={{color: 'red'}}>*</span></label>
            <input
              type="text"
              value={formData.project_name}
              onChange={(e) => updateField('project_name', e.target.value)}
              placeholder="Nhập tên dự án"
            />
          </div>

          <div className="field">
            <label>Chủ đầu tư</label>
            <select
              value={formData.customer_id}
              onChange={(e) => updateField('customer_id', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Chọn chủ đầu tư --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ngày ký</label>
            <input
              type="date"
              value={formData.contract_date}
              onChange={(e) => updateField('contract_date', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Gói thầu</label>
            <input
              type="text"
              value={formData.tender_name}
              onChange={(e) => updateField('tender_name', e.target.value)}
              placeholder="Nhập tên gói thầu"
            />
          </div>

          <div className="field">
            <label>Số PA KD / UQ</label>
            <input
              type="text"
              value={formData.pakd_no}
              onChange={(e) => updateField('pakd_no', e.target.value)}
              placeholder="Số phương án KD"
            />
          </div>

          <div className="field">
            <label>Mã quản lý nội bộ</label>
            <input
              type="text"
              value={formData.uq_no}
              onChange={(e) => updateField('uq_no', e.target.value)}
              placeholder="Mã UQ"
            />
          </div>

          <div className="field">
            <label>Loại hợp đồng</label>
            <input
              type="text"
              value={formData.contract_type}
              onChange={(e) => updateField('contract_type', e.target.value)}
              placeholder="Loại hợp đồng"
            />
          </div>

          <div className="field">
            <label>Đơn vị tiền tệ</label>
            <select
              value={formData.currency_code}
              onChange={(e) => updateField('currency_code', e.target.value)}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          <div className="field">
            <label>Tỷ giá</label>
            <input
              type="number"
              step="0.0001"
              value={formData.exchange_rate}
              onChange={(e) => updateField('exchange_rate', e.target.value ? Number(e.target.value) : 1)}
              placeholder="Tỷ giá quy đổi"
            />
          </div>

          <div className="field">
            <label>Trước VAT</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_before_vat}
              onChange={(e) => updateField('amount_before_vat', e.target.value ? Number(e.target.value) : '')}
              placeholder="Giá trị trước VAT"
            />
          </div>

          <div className="field">
            <label>Sau VAT</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_after_vat}
              onChange={(e) => updateField('amount_after_vat', e.target.value ? Number(e.target.value) : '')}
              placeholder="Giá trị sau VAT"
            />
          </div>

          <div className="field">
            <label>Trạng thái</label>
            <select
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value)}
            >
              <option value="">-- Chọn trạng thái --</option>
              <option value="Dự thảo">Dự thảo</option>
              <option value="Đã ký">Đã ký</option>
              <option value="Đang thực hiện">Đang thực hiện</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Hủy">Hủy</option>
            </select>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Điều khoản thanh toán</label>
            <textarea
              value={formData.payment_term}
              onChange={(e) => updateField('payment_term', e.target.value)}
              placeholder="Nhập điều khoản thanh toán"
              rows="3"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={() => { onClose(); resetForm() }}>
            Hủy
          </button>
          <button
            className="save-btn"
            onClick={handleSubmit}
          >
            {isEdit ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
