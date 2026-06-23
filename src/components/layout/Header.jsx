import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../config/api'
import { parseDeepLink } from '../../components/common/deepLink'
import { getBrand } from '../../config/brand'
import fallbackLogo from '../../assets/tecapro-logo.png'

const brand = getBrand() // logo + tên doanh nghiệp, đã nạp từ brand.json lúc khởi động

const MENUS = [
  { label: 'Trang chủ',        path: '/'        },
  { label: 'Hợp đồng bán',    path: '/qlda'    },
  {
    label: 'Công việc',
    children: [
      { label: 'KT Cơ điện', path: '/cong-viec/kt-co-dien', dept: 7 },
      { label: 'Kế hoạch đấu thầu', path: '/cong-viec/dau-thau', dept: 9 },
    ],
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const navRef = useRef(null)
  const searchRef = useRef(null)

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

  // Đóng ô tra cứu công việc khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!searchOpen) return
    const onDocClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey) }
  }, [searchOpen])

  // "Hợp đồng bán" chỉ hiện cho admin hoặc người đang tham gia ít nhất một dự án.
  const canSeeContracts = !!user && (Number(user.role) === 1 || user.has_projects)
  const isAdmin = !!user && Number(user.role) === 1
  // Mỗi mục con của "Công việc" gắn với một phòng ban (dept). Admin thấy hết; còn lại
  // chỉ thấy mục của phòng mình. Dropdown hiện khi có ít nhất một mục con hợp lệ.
  const canSeeChild = (c) => isAdmin || (!!user && Number(user.department_id) === c.dept)
  const menus = MENUS
    .map(m => m.children ? { ...m, children: m.children.filter(canSeeChild) } : m)
    .filter(m => {
      if (m.path === '/qlda') return canSeeContracts
      if (m.children) return m.children.length > 0
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

  // Dán đường dẫn (đã sao chép từ menu "Sao chép thông tin") → nhảy đúng vị trí.
  function handleTaskSearch(e) {
    e?.preventDefault()
    const path = parseDeepLink(searchText)
    if (!path) {
      alert('Không nhận dạng được đường dẫn. Hãy dán đúng đoạn đã sao chép (có dòng 🔗).')
      return
    }
    setSearchOpen(false)
    setSearchText('')
    setMobileMenuOpen(false)
    navigate(path)
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
          <img
            className="brand-logo"
            src={brand.logo || fallbackLogo}
            alt={brand.name}
            onError={(e) => { e.currentTarget.src = fallbackLogo }}
          />
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
          <span className="topbar-branch">{brand.tagline || brand.name}</span>
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
              <div className="topbar-search" ref={searchRef}>
                <button
                  type="button"
                  className="topbar-btn topbar-icon-btn"
                  title="Tra cứu: dán đường dẫn đã sao chép để nhảy tới đúng vị trí (việc, công nợ, bảo hành...)"
                  aria-label="Tra cứu theo đường dẫn đã sao chép"
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen(o => !o)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.3-4.3"></path>
                  </svg>
                </button>
                {searchOpen && (
                  <form className="topbar-search-pop" onSubmit={handleTaskSearch}>
                    <input
                      type="text"
                      autoFocus
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      placeholder="Dán đường dẫn đã sao chép..."
                      aria-label="Đường dẫn đã sao chép"
                    />
                    <button type="submit" className="topbar-search-go">Đi tới</button>
                  </form>
                )}
              </div>
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
