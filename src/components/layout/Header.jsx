import { useState } from 'react'
import tecaproLogo from '../../assets/tecapro-logo.png'

export default function Header({ user, activeMenu, onNavigate, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menus = [
    'Trang chủ',
    'Hợp đồng bán',
    'Tài liệu',
    'Các tác vụ',
    'Quản trị hệ thống',
  ]

  function handleMenuClick(m) {
    setMobileMenuOpen(false)
    if (m === 'Quản trị hệ thống') {
      if (user) {
        onNavigate('Quản lý người dùng', 'admin')
      } else {
        onNavigate('Quản trị hệ thống', 'login')
      }
    } else {
      onNavigate(m, 'home')
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => { setMobileMenuOpen(false); onNavigate('Trang chủ', 'home') }}
          aria-label="Trang chủ"
        >
          <img className="brand-logo" src={tecaproLogo} alt="TECAPRO" />
        </button>

        <nav className={`menu${mobileMenuOpen ? ' menu--open' : ''}`} aria-label="Chính">
          {menus.map((m) => (
            <button
              key={m}
              type="button"
              className={`menu-item ${activeMenu === m ? 'is-active' : ''}`}
              onClick={() => handleMenuClick(m)}
            >
              {m}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-pill" title={user.email}>
                {user.full_name}
              </span>
              <button type="button" className="topbar-btn" onClick={() => { setMobileMenuOpen(false); onLogout() }}>
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              className="topbar-btn"
              onClick={() => { setMobileMenuOpen(false); onNavigate('Quản trị hệ thống', 'login') }}
            >
              Đăng nhập
            </button>
          )}
        </div>

        <button
          type="button"
          className="hamburger"
          aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setMobileMenuOpen(o => !o)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  )
}
