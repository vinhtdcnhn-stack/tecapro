import { useState, useEffect } from 'react'
import Modal from '../common/Modal'

export default function CustomerModal({
  isOpen, 
  onClose, 
  onSave, 
  customer = null 
}) {
  const isEdit = !!customer
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    tax_code: '',
    address: '',
    contact_person: '',
    phone: '',
    email: '',
    is_active: true
  })

  useEffect(() => {
    if (customer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ form từ prop customer khi mở modal sửa
      setFormData({
        code: customer.code || '',
        name: customer.name || '',
        tax_code: customer.tax_code || '',
        address: customer.address || '',
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        is_active: customer.is_active ?? true
      })
    } else {
      resetForm()
    }
  }, [customer, isOpen])

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      tax_code: '',
      address: '',
      contact_person: '',
      phone: '',
      email: '',
      is_active: true
    })
  }

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    // Validate required fields
    if (!formData.code || !formData.name) {
      alert('Vui lòng nhập mã khách hàng và tên khách hàng!')
      return
    }

    await onSave(formData, isEdit)
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm() }} labelledBy="customer-modal-title">
        <div className="modal-header">
          <h2 id="customer-modal-title">{isEdit ? 'SỬA KHÁCH HÀNG' : 'THÊM KHÁCH HÀNG'}</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }} aria-label="Đóng">✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Mã khách hàng <span style={{color: 'red'}}>*</span></label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => updateField('code', e.target.value)}
              placeholder="Nhập mã khách hàng"
            />
          </div>

          <div className="field">
            <label>Tên khách hàng <span style={{color: 'red'}}>*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Nhập tên khách hàng"
            />
          </div>

          <div className="field">
            <label>Mã số thuế</label>
            <input
              type="text"
              value={formData.tax_code}
              onChange={(e) => updateField('tax_code', e.target.value)}
              placeholder="Nhập mã số thuế"
            />
          </div>

          <div className="field">
            <label>Địa chỉ</label>
            <textarea
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Nhập địa chỉ"
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

          <div className="field">
            <label>Người liên hệ</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => updateField('contact_person', e.target.value)}
              placeholder="Nhập tên người liên hệ"
            />
          </div>

          <div className="field">
            <label>Số điện thoại</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="Nhập email"
            />
          </div>

          <div className="field">
            <label>Trạng thái</label>
            <select
              value={formData.is_active ? '1' : '0'}
              onChange={(e) => updateField('is_active', e.target.value === '1')}
            >
              <option value="1">Hoạt động</option>
              <option value="0">Ngừng hoạt động</option>
            </select>
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
    </Modal>
  )
}
