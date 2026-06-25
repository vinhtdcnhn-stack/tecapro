import { useState } from 'react'
import Modal from '../common/Modal'
import { useAuth } from '../../context/AuthContext'

export default function ChangePasswordModal({ isOpen, onClose, onSave }) {
  const { user, updateTelegram, testTelegram } = useAuth()

  const [tab, setTab] = useState('password') // 'password' | 'telegram'

  // --- Tab đổi mật khẩu ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // --- Tab Telegram ---
  // Khởi tạo từ Chat ID hiện tại; modal được remount mỗi lần mở (key ở parent) nên giá trị luôn mới.
  const [chatId, setChatId] = useState(() => user?.telegram_chat_id || '')
  const [tgSaving, setTgSaving] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgResult, setTgResult] = useState(null) // { ok, msg } | null

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

  async function handleTestTelegram() {
    const id = chatId.trim()
    if (!id) {
      setTgResult({ ok: false, msg: 'Vui lòng nhập Telegram Chat ID trước.' })
      return
    }
    setTgTesting(true)
    setTgResult(null)
    try {
      await testTelegram(id)
      setTgResult({ ok: true, msg: 'Đã gửi tin nhắn thử. Kiểm tra Telegram nhé!' })
    } catch (err) {
      setTgResult({ ok: false, msg: err.message || 'Không gửi được tin nhắn.' })
    } finally {
      setTgTesting(false)
    }
  }

  async function handleSaveTelegram(e) {
    e.preventDefault()
    setTgResult(null)
    setTgSaving(true)
    try {
      await updateTelegram(chatId.trim())
      setTgResult({ ok: true, msg: 'Đã lưu Telegram Chat ID.' })
    } catch (err) {
      setTgResult({ ok: false, msg: err.message || 'Cập nhật thất bại.' })
    } finally {
      setTgSaving(false)
    }
  }

  function handleClose() {
    setTab('password')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setTgResult(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} width={440} className="changepw-modal" labelledBy="changepw-title">
      <div className="modal-header">
        <h2 id="changepw-title">Tài khoản của tôi</h2>
        <button type="button" className="close-btn" onClick={handleClose} aria-label="Đóng">✕</button>
      </div>

      <div className="changepw-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'password'}
          className={`changepw-tab ${tab === 'password' ? 'active' : ''}`}
          onClick={() => setTab('password')}
        >
          Đổi mật khẩu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'telegram'}
          className={`changepw-tab ${tab === 'telegram' ? 'active' : ''}`}
          onClick={() => setTab('telegram')}
        >
          Telegram
        </button>
      </div>

      {tab === 'password' && (
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
      )}

      {tab === 'telegram' && (
        <form onSubmit={handleSaveTelegram}>
          <div className="changepw-body">
            <p className="changepw-hint">
              Nhập Telegram Chat ID để nhận thông báo của hệ thống. Bấm <b>Gửi thử</b> để
              kiểm tra trước khi lưu.
            </p>
            {tgResult && (
              <div className={tgResult.ok ? 'changepw-ok' : 'changepw-error'}>{tgResult.msg}</div>
            )}
            <div className="field">
              <label>Telegram Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={e => { setChatId(e.target.value); setTgResult(null) }}
                placeholder="VD: 123456789"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="cancel-btn"
              onClick={handleTestTelegram}
              disabled={tgTesting || !chatId.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              {tgTesting ? 'Đang gửi...' : 'Gửi thử'}
            </button>
          </div>
          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={handleClose}>Hủy</button>
            <button type="submit" className="save-btn" disabled={tgSaving}>
              {tgSaving ? 'Đang lưu...' : 'Lưu Telegram'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
