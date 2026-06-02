import { useState, useEffect } from 'react'

export default function UserModal({ 
  isOpen, 
  onClose, 
  onSave, 
  user = null, 
  departments = [], 
  positions = [], 
  managers = [],
  checkEmailExists,
  checkUsernameExists,
  checkEmployeeCodeExists
}) {
  const isEdit = !!user
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    employee_code: '',
    department_id: '',
    position_ids: [],
    manager_id: '',
    role: '2',
    telegram_chat_id: ''
  })

  const [errors, setErrors] = useState({
    email: '',
    username: '',
    employee_code: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        password: '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        employee_code: user.employee_code || '',
        department_id: user.department_id || '',
        position_ids: Array.isArray(user.positions) ? user.positions.map(p => p.id) : [],
        manager_id: user.manager_id || '',
        role: String(user.role),
        telegram_chat_id: user.telegram_chat_id || ''
      })
      setErrors({ email: '', username: '', employee_code: '' })
    } else {
      resetForm()
    }
  }, [user, isOpen])

  function resetForm() {
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      employee_code: '',
      department_id: '',
      position_ids: [],
      manager_id: '',
      role: '2',
      telegram_chat_id: ''
    })
    setErrors({ email: '', username: '', employee_code: '' })
  }

  function updateField(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when typing
    if (['email', 'username', 'employee_code'].includes(field)) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  async function handleBlur(field, value) {
    if (field === 'email') {
      await checkEmailExists(value, (exists) => {
        setErrors(prev => ({ ...prev, email: exists ? 'Email này đã tồn tại trong hệ thống.' : '' }))
      })
    } else if (field === 'username') {
      await checkUsernameExists(value, (exists) => {
        setErrors(prev => ({ ...prev, username: exists ? 'Tên đăng nhập này đã tồn tại.' : '' }))
      })
    } else if (field === 'employee_code') {
      await checkEmployeeCodeExists(value, (exists) => {
        setErrors(prev => ({ ...prev, employee_code: exists ? 'Mã nhân viên này đã tồn tại.' : '' }))
      })
    }
  }

  async function handleSubmit() {
    if (errors.email || errors.username || errors.employee_code) {
      alert('Vui lòng sửa các lỗi trùng lặp trước khi lưu!')
      return
    }

    const requiredFields = ['email', 'username']
    if (!isEdit) requiredFields.push('password')
    
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Vui lòng nhập ${field === 'username' ? 'tên đăng nhập' : field === 'email' ? 'email' : 'mật khẩu'}!`)
        return
      }
    }

    await onSave(formData, isEdit)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? 'SỬA NGƯỜI DÙNG' : 'THÊM NGƯỜI DÙNG'}</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Tên đăng nhập</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => updateField('username', e.target.value)}
              onBlur={() => handleBlur('username', formData.username)}
            />
            {errors.username && <p style={{ color: 'red', fontSize: '12px' }}>{errors.username}</p>}
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              onBlur={() => handleBlur('email', formData.email)}
            />
            {errors.email && <p style={{ color: 'red', fontSize: '12px' }}>{errors.email}</p>}
          </div>

          <div className="field">
            <label>Họ tên</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Mã nhân viên</label>
            <input
              type="text"
              value={formData.employee_code}
              onChange={(e) => updateField('employee_code', e.target.value)}
              onBlur={() => handleBlur('employee_code', formData.employee_code)}
            />
            {errors.employee_code && <p style={{ color: 'red', fontSize: '12px' }}>{errors.employee_code}</p>}
          </div>

          <div className="field">
            <label>Phòng ban</label>
            <select
              value={formData.department_id}
              onChange={(e) => updateField('department_id', e.target.value)}
            >
              <option value="">Chọn phòng ban</option>
              {departments.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Vị trí <span style={{ fontWeight: 'normal', color: '#888', fontSize: 12 }}>(có thể chọn nhiều)</span></label>
            <div style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', maxHeight: 160, overflowY: 'auto', background: '#fff' }}>
              {positions.length === 0 ? (
                <span style={{ color: '#9ca3af', fontSize: 13 }}>Không có vị trí nào</span>
              ) : positions.map(pos => (
                <label key={pos.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formData.position_ids.includes(pos.id)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...formData.position_ids, pos.id]
                        : formData.position_ids.filter(id => id !== pos.id)
                      updateField('position_ids', next)
                    }}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>{pos.name}</span>
                </label>
              ))}
            </div>
            {formData.position_ids.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                Đã chọn: {positions.filter(p => formData.position_ids.includes(p.id)).map(p => p.name).join(', ')}
              </div>
            )}
          </div>

          <div className="field">
            <label>Quản lý trực tiếp</label>
            <select
              value={formData.manager_id}
              onChange={(e) => updateField('manager_id', e.target.value)}
            >
              <option value="">Chọn quản lý</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Vai trò</label>
            <select
              value={formData.role}
              onChange={(e) => updateField('role', e.target.value)}
            >
              <option value="1">Admin</option>
              <option value="2">User</option>
            </select>
          </div>

          <div className="field">
            <label>Số điện thoại</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Telegram Chat ID <span style={{ fontWeight: 'normal', color: '#888', fontSize: 12 }}>(để nhận thông báo)</span></label>
            <input
              type="text"
              value={formData.telegram_chat_id}
              onChange={(e) => updateField('telegram_chat_id', e.target.value)}
              placeholder="VD: 123456789"
            />
          </div>

          <div className="field">
            <label>{isEdit ? 'Mật khẩu (để trống nếu không đổi)' : 'Mật khẩu'}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder={isEdit ? 'Nhập mật khẩu mới' : ''}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={() => { onClose(); resetForm() }}>
            Hủy
          </button>
          <button
            className="save-btn"
            disabled={!!errors.email || !!errors.username || !!errors.employee_code || !formData.email || !formData.username || (!isEdit && !formData.password)}
            onClick={handleSubmit}
          >
            {isEdit ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
