import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { API_BASE } from '../../config/api'
import { selectableUsers, userLabel } from '../../lib/userStatus'

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
    department_ids: [],
    position_ids: [],
    manager_id: '',
    role: '2',
    telegram_chat_id: '',
    is_active: true
  })

  const [errors, setErrors] = useState({
    email: '',
    username: '',
    employee_code: ''
  })

  // Trạng thái gửi thử Telegram: idle | sending; tgResult = { ok, msg } | null
  const [tgSending, setTgSending] = useState(false)
  const [tgResult, setTgResult] = useState(null)

  async function handleTestTelegram() {
    const chatId = formData.telegram_chat_id?.trim()
    if (!chatId) {
      setTgResult({ ok: false, msg: 'Vui lòng nhập Telegram Chat ID trước.' })
      return
    }
    setTgSending(true)
    setTgResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/users/test-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_chat_id: chatId, full_name: formData.full_name }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setTgResult({ ok: true, msg: 'Đã gửi tin nhắn chào mừng. Kiểm tra Telegram nhé!' })
      } else {
        setTgResult({ ok: false, msg: data.error || 'Không gửi được tin nhắn.' })
      }
    } catch (err) {
      console.error('test-telegram:', err)
      setTgResult({ ok: false, msg: 'Lỗi kết nối tới máy chủ. Thử lại sau giây lát.' })
    } finally {
      setTgSending(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trạng thái gửi thử khi mở modal
    setTgResult(null)
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        password: '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        employee_code: user.employee_code || '',
        department_id: user.department_id || '',
        department_ids: Array.isArray(user.extra_departments) ? user.extra_departments.map(d => d.id) : [],
        position_ids: Array.isArray(user.positions) ? user.positions.map(p => p.id) : [],
        manager_id: user.manager_id || '',
        role: String(user.role),
        telegram_chat_id: user.telegram_chat_id || '',
        is_active: user.is_active !== false
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
      department_ids: [],
      position_ids: [],
      manager_id: '',
      role: '2',
      telegram_chat_id: '',
      is_active: true
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

    if (isEdit && user?.is_active !== false && formData.is_active === false) {
      const ok = window.confirm(
        `Chuyển "${formData.full_name || formData.username}" sang ĐÃ NGHỈ VIỆC?\n\n`
        + '• Tài khoản sẽ bị đăng xuất ngay và không đăng nhập lại được.\n'
        + '• Không còn hiện trong các ô chọn người để giao việc mới.\n'
        + '• Dữ liệu cũ vẫn giữ nguyên — có thể bật lại bất cứ lúc nào.'
      )
      if (!ok) return
    }

    await onSave(formData, isEdit)
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm() }} labelledBy="user-modal-title">
        <div className="modal-header">
          <h2 id="user-modal-title">{isEdit ? 'SỬA NGƯỜI DÙNG' : 'THÊM NGƯỜI DÙNG'}</h2>
          <button className="close-btn" onClick={() => { onClose(); resetForm() }} aria-label="Đóng">✕</button>
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
            <label>Phòng ban <span style={{ fontWeight: 'normal', color: '#888', fontSize: 12 }}>(phòng chính)</span></label>
            <select
              value={formData.department_id}
              onChange={(e) => {
                const val = e.target.value
                setFormData(prev => ({
                  ...prev,
                  department_id: val,
                  // Phòng chính không thể đồng thời là ban kiêm nhiệm → loại khỏi danh sách.
                  department_ids: prev.department_ids.filter(id => String(id) !== String(val)),
                }))
              }}
            >
              <option value="">Chọn phòng ban</option>
              {departments.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Quản lý trực tiếp</label>
            <select
              value={formData.manager_id}
              onChange={(e) => updateField('manager_id', e.target.value)}
            >
              <option value="">Chọn quản lý</option>
              {selectableUsers(managers, formData.manager_id).map(m => (
                <option key={m.id} value={m.id}>{userLabel(m)}</option>
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
            <label>Ban kiêm nhiệm <span style={{ fontWeight: 'normal', color: '#888', fontSize: 12 }}>(thuộc thêm ban khác — chỉ để cấp quyền)</span></label>
            <div style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', maxHeight: 160, overflowY: 'auto', background: '#fff' }}>
              {departments.filter(dep => String(dep.id) !== String(formData.department_id)).length === 0 ? (
                <span style={{ color: '#9ca3af', fontSize: 13 }}>Không có ban nào khác</span>
              ) : departments.filter(dep => String(dep.id) !== String(formData.department_id)).map(dep => (
                <label key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formData.department_ids.includes(dep.id)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...formData.department_ids, dep.id]
                        : formData.department_ids.filter(id => id !== dep.id)
                      updateField('department_ids', next)
                    }}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>{dep.name}</span>
                </label>
              ))}
            </div>
            {formData.department_ids.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                Kiêm nhiệm: {departments.filter(d => formData.department_ids.includes(d.id)).map(d => d.name).join(', ')}
              </div>
            )}
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
            <label>Trạng thái làm việc</label>
            <select
              value={formData.is_active ? 'active' : 'inactive'}
              onChange={(e) => updateField('is_active', e.target.value === 'active')}
            >
              <option value="active">Đang làm việc</option>
              <option value="inactive">Đã nghỉ việc (ngừng hoạt động)</option>
            </select>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
              Nhân sự nghỉ việc hãy chuyển sang <b>Đã nghỉ việc</b> thay vì xóa tài khoản: người
              đó không đăng nhập được nữa và không hiện ra khi giao việc mới, nhưng toàn bộ dữ
              liệu cũ (hợp đồng, công việc, biên bản…) vẫn giữ nguyên tên họ.
            </p>
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
              onChange={(e) => { updateField('telegram_chat_id', e.target.value); setTgResult(null) }}
              placeholder="VD: 123456789"
            />
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={tgSending || !formData.telegram_chat_id?.trim()}
                style={{
                  padding: '6px 12px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                  border: '1px solid #0ea5e9', background: '#fff', color: '#0369a1',
                  opacity: (tgSending || !formData.telegram_chat_id?.trim()) ? 0.6 : 1,
                }}
              >
                {tgSending ? 'Đang gửi…' : '📨 Gửi tin nhắn kiểm tra'}
              </button>
              {tgResult && (
                <span style={{ fontSize: 12, color: tgResult.ok ? '#15803d' : '#dc2626' }}>
                  {tgResult.ok ? '✓ ' : '✕ '}{tgResult.msg}
                </span>
              )}
            </div>
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
    </Modal>
  )
}
