import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../config/api'
import tecaproLogo from '../../assets/tecapro-logo.png'

const MENUS = [
  { label: 'Trang chủ',        path: '/'        },
  { label: 'Hợp đồng bán',    path: '/qlda'    },
  {
    label: 'Công việc',
    children: [{ label: 'KT Cơ điện', path: '/cong-viec/kt-co-dien' }],
  },
  { label: 'Đề xuất',          path: '/de-xuat' },
  { label: 'Tra cứu bảo hành', path: '/tracuu'  },
  { label: 'Hệ thống', path: '/quantri', desktopOnly: true },
]

export default function Header({ onChangePassword }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [inboxCount, setInboxCount] = useState(0)
  const navRef = useRef(null)

  // Số đơn đang chờ chính mình duyệt (badge trên menu "Đề xuất").
  // Tải khi đăng nhập / đổi trang, và tự làm mới mỗi 60 giây.
  useEffect(() => {
    if (!user) return
    let alive = true
    const loadCount = () => {
      fetch(`${API}/approvals/requests/inbox`)
        .then(r => r.ok ? r.json() : [])
        .then(d => { if (alive) setInboxCount(Array.isArray(d) ? d.length : 0) })
        .catch(() => {})
    }
    loadCount()
    const timer = setInterval(loadCount, 60000)
    return () => { alive = false; clearInterval(timer) }
  }, [user, location.pathname])

  // Đóng dropdown khi bấm ra ngoài thanh menu.
  useEffect(() => {
    if (!openDropdown) return
    const onDocClick = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpenDropdown(null) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openDropdown])

  // "Hợp đồng bán" chỉ hiện cho admin hoặc người đang tham gia ít nhất một dự án.
  const canSeeContracts = !!user && (Number(user.role) === 1 || user.has_projects)
  // "Công việc → KT Cơ điện" chỉ hiện cho thành viên Ban KT Cơ điện (dept 7).
  const canSeeDeptWork = !!user && Number(user.department_id) === 7
  const menus = MENUS.filter(m => {
    if (m.path === '/qlda') return canSeeContracts
    if (m.label === 'Công việc') return canSeeDeptWork
    return true
  })

  function isActive(menu) {
    if (menu.children) return menu.children.some(c => location.pathname.startsWith(c.path))
    if (menu.path === '/') return location.pathname === '/' || location.pathname === '/giaoban'
    return location.pathname.startsWith(menu.path)
  }

  function go(path) {
    setMobileMenuOpen(false)
    setOpenDropdown(null)
    navigate(path)
  }

  function handleMenuClick(menu) {
    if (menu.path === '/quantri' && !user) { go('/login'); return }
    go(menu.path)
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
          <nav ref={navRef} className={`menu${mobileMenuOpen ? ' menu--open' : ''}`} aria-label="Chính">
            {menus.map((m) => (
              m.children ? (
                <div key={m.label} className={`menu-dropdown${openDropdown === m.label ? ' open' : ''} ${m.desktopOnly ? 'menu-item--desktop-only' : ''}`}>
                  <button
                    type="button"
                    className={`menu-item ${isActive(m) ? 'is-active' : ''}`}
                    aria-haspopup="true"
                    aria-expanded={openDropdown === m.label}
                    onClick={() => setOpenDropdown(o => o === m.label ? null : m.label)}
                  >
                    {m.label} ▾
                  </button>
                  <div className="menu-dropdown-panel">
                    {m.children.map(c => (
                      <button
                        key={c.path}
                        type="button"
                        className={`menu-dropdown-item ${location.pathname.startsWith(c.path) ? 'is-active' : ''}`}
                        onClick={() => go(c.path)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  key={m.label}
                  type="button"
                  className={`menu-item ${isActive(m) ? 'is-active' : ''} ${m.desktopOnly ? 'menu-item--desktop-only' : ''}`}
                  onClick={() => handleMenuClick(m)}
                >
                  {m.label}
                  {m.path === '/de-xuat' && inboxCount > 0 && (
                    <span className="menu-badge" title={`${inboxCount} đơn chờ bạn duyệt`}>🔔 {inboxCount}</span>
                  )}
                </button>
              )
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
