import { useState } from 'react'

export default function LoginForm({ onLogin, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    onLogin(e, email, password)
  }

  return (
    <div className="content">
      <div className="login-header">
        <p className="eyebrow">TECAPRO</p>
        <h2 className="login-title">ĐĂNG NHẬP</h2>
        <p className="subtitle login-subtitle">Hệ thống quản lý nội bộ</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label">Email</label>
          <input
            type="email"
            className="field-input"
            placeholder="Nhập email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Mật khẩu</label>
          <input
            type="password"
            className="field-input"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn--full">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
