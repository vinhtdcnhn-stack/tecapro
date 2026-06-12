import { useState, useEffect } from 'react'
import Modal from '../common/Modal'

export default function SupplierModal({ isOpen, onClose, onSave, supplier = null }) {
  const isEdit = !!supplier

  const [formData, setFormData] = useState({
    code: '', name: '', tax_code: '', address: '',
    contact_person: '', phone: '', email: '', note: '', is_active: true,
  })

  useEffect(() => {
    if (supplier) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ form từ prop supplier khi mở modal sửa
      setFormData({
        code:           supplier.code           || '',
        name:           supplier.name           || '',
        tax_code:       supplier.tax_code       || '',
        address:        supplier.address        || '',
        contact_person: supplier.contact_person || '',
        phone:          supplier.phone          || '',
        email:          supplier.email          || '',
        note:           supplier.note           || '',
        is_active:      supplier.is_active      ?? true,
      })
    } else {
      resetForm()
    }
  }, [supplier, isOpen])

  function resetForm() {
    setFormData({ code: '', name: '', tax_code: '', address: '', contact_person: '', phone: '', email: '', note: '', is_active: true })
  }

  function set(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('Vui lòng nhập mã và tên nhà cung cấp!')
      return
    }
    await onSave(formData, isEdit)
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm() }} labelledBy="supplier-modal-title">
        <div className="modal-header">
          <h2 id="supplier-modal-title">{isEdit ? 'SỬA NHÀ CUNG CẤP' : 'THÊM NHÀ CUNG CẤP'}</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }} aria-label="Đóng">✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Mã nhà cung cấp <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              value={formData.code}
              onChange={e => set('code', e.target.value)}
              placeholder="VD: NCC-001"
            />
          </div>

          <div className="field">
            <label>Tên nhà cung cấp <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Nhập tên nhà cung cấp"
            />
          </div>

          <div className="field">
            <label>Mã số thuế</label>
            <input
              type="text"
              value={formData.tax_code}
              onChange={e => set('tax_code', e.target.value)}
              placeholder="Nhập mã số thuế"
            />
          </div>

          <div className="field">
            <label>Địa chỉ</label>
            <textarea
              rows="3"
              value={formData.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Nhập địa chỉ"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div className="field">
            <label>Người liên hệ</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={e => set('contact_person', e.target.value)}
              placeholder="Nhập tên người liên hệ"
            />
          </div>

          <div className="field">
            <label>Số điện thoại</label>
            <input
              type="text"
              value={formData.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => set('email', e.target.value)}
              placeholder="Nhập email"
            />
          </div>

          <div className="field">
            <label>Ghi chú</label>
            <textarea
              rows="2"
              value={formData.note}
              onChange={e => set('note', e.target.value)}
              placeholder="Ghi chú thêm về nhà cung cấp..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div className="field">
            <label>Trạng thái</label>
            <select
              value={formData.is_active ? '1' : '0'}
              onChange={e => set('is_active', e.target.value === '1')}
            >
              <option value="1">Hoạt động</option>
              <option value="0">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={() => { onClose(); resetForm() }}>Hủy</button>
          <button className="save-btn" onClick={handleSubmit}>
            {isEdit ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
    </Modal>
  )
}
