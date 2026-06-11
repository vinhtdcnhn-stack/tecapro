import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import tecaproLogo from '../../assets/tecapro-logo.png'

const MENUS = [
  { label: 'Trang chủ',        path: '/'        },
  { label: 'Hợp đồng bán',    path: '/qlda',    desktopOnly: true },
  { label: 'Tra cứu bảo hành', path: '/tracuu'  },
  { label: 'Giao ban tuần',    path: '/giaoban', desktopOnly: true },
  { label: 'Quản trị hệ thống', path: '/quantri', desktopOnly: true },
]

export default function Header({ onChangePassword }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function isActive(menu) {
    if (menu.path === '/') return location.pathname === '/' || location.pathname === '/giaoban'
    return location.pathname.startsWith(menu.path)
  }

  function handleMenuClick(menu) {
    setMobileMenuOpen(false)
    if (menu.label === 'Quản trị hệ thống' && !user) {
      navigate('/login')
    } else {
      navigate(menu.path)
    }
  }

  function handleLogout() {
    setMobileMenuOpen(false)
    logout()
    navigate('/')
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => { setMobileMenuOpen(false); navigate('/') }}
          aria-label="Trang chủ"
        >
          <img className="brand-logo" src={tecaproLogo} alt="TECAPRO" />
        </button>

        {user ? (
          <nav className={`menu${mobileMenuOpen ? ' menu--open' : ''}`} aria-label="Chính">
            {MENUS.map((m) => (
              <button
                key={m.label}
                type="button"
                className={`menu-item ${isActive(m) ? 'is-active' : ''} ${m.desktopOnly ? 'menu-item--desktop-only' : ''}`}
                onClick={() => handleMenuClick(m)}
              >
                {m.label}
              </button>
            ))}
          </nav>
        ) : (
          <span className="topbar-branch">Chi nhánh Hà nội - Công ty TECAPRO</span>
        )}

        <div className="topbar-actions">
          {user ? (
            <>
              <button
                type="button"
                className="user-pill"
                title={`${user.email} — Nhấn để đổi mật khẩu`}
                onClick={() => { setMobileMenuOpen(false); onChangePassword() }}
              >
                {user.full_name}
              </button>
              <button type="button" className="topbar-btn" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              className="topbar-btn"
              onClick={() => { setMobileMenuOpen(false); navigate('/login') }}
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
