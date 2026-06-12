import { useState } from 'react'
import Modal from '../common/Modal'

export default function ChangePasswordModal({ isOpen, onClose, onSave }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin.')
      return
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setLoading(true)
    await onSave(currentPassword, newPassword)
    setLoading(false)
  }

  function handleClose() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} width={440} className="changepw-modal" labelledBy="changepw-title">
        <div className="modal-header">
          <h2 id="changepw-title">Đổi mật khẩu</h2>
          <button type="button" className="close-btn" onClick={handleClose} aria-label="Đóng">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="changepw-body">
            {error && <div className="changepw-error">{error}</div>}
            <div className="field">
              <label>Mật khẩu hiện tại</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <div className="field">
              <label>Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={handleClose}>Hủy</button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
