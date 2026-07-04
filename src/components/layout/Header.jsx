import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePermission } from '../../hooks/usePermission'
import { useSectionNav } from '../../context/SectionNavContext'
import { useHomeDashboards } from '../../lib/useHomeDashboards'
import HelpPanel from '../help/HelpPanel'
import { resolveHelpTarget } from '../help/helpContext'
import DashSwitcher from '../../pages/DashSwitcher'
import { getBrand } from '../../config/brand'
import fallbackLogo from '../../assets/tecapro-logo.png'

const brand = getBrand() // logo + tên doanh nghiệp, đã nạp từ brand.json lúc khởi động

// `perm` = quyền (lớp A) cần để THẤY mục. Trang chủ luôn hiện. Admin fail-open (usePermission).
const MENUS = [
  { label: 'Trang chủ',        path: '/'        },
  { label: 'Hợp đồng bán',    path: '/qlda', perm: 'module.contracts.view' },
  {
    label: 'Công việc',
    children: [
      { label: 'Dự án và chuyển giao công nghệ', path: '/cong-viec/kt-co-dien', perm: 'module.deptwork.view' },
      { label: 'Kế hoạch đấu thầu', path: '/cong-viec/dau-thau', perm: 'module.tender.view' },
    ],
  },
  { label: 'Đề xuất',          path: '/de-xuat', perm: 'module.approvals.view' },
  { label: 'Tra cứu bảo hành', path: '/tracuu', perm: 'module.warranty_lookup.view' },
  { label: 'Hệ thống', path: '/quantri', perm: 'module.system.view' },
]

export default function Header({ onChangePassword, inboxCount = 0 }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTarget, setHelpTarget] = useState(null)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const navRef = useRef(null)
  const sectionNavRef = useRef(null)

  // Thanh chọn mục trong module (mobile) — trang con đăng ký qua useRegisterSectionNav.
  // Sidebar bị ẩn ở mobile nên nút icon này (cạnh nút trợ giúp) thay việc chuyển trang.
  const sectionNav = useSectionNav()

  // Nút đổi bảng điều khiển trang chủ — trên mobile thay cho ô tra cứu (ẩn trên mobile).
  // Chỉ hiện ở trang chủ vì các bảng điều khiển là khái niệm của trang chủ.
  const { available, active, pick } = useHomeDashboards()
  const onHome = location.pathname === '/' || location.pathname === '/giaoban'

  // Số đơn chờ chính mình duyệt (badge menu "Đề xuất") đến từ long-poll hợp nhất ở App
  // (useLiveAlerts) — không còn tự poll định kỳ tại đây.

  // Đóng dropdown khi bấm ra ngoài thanh menu.
  useEffect(() => {
    if (!openDropdown) return
    const onDocClick = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpenDropdown(null) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openDropdown])

  // Đóng menu chọn mục khi bấm ra ngoài (chọn 1 mục sẽ tự đóng trong onClick).
  useEffect(() => {
    if (!sectionMenuOpen) return
    const onDocClick = (e) => { if (sectionNavRef.current && !sectionNavRef.current.contains(e.target)) setSectionMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [sectionMenuOpen])

  // Lọc menu theo RBAC lớp A (usePermission, admin fail-open). Mục con "Công việc" gắn
  // perm riêng; dropdown hiện khi có ít nhất một mục con hợp lệ. Mục không khai perm luôn hiện.
  const { has } = usePermission()
  const menus = MENUS
    .map(m => m.children ? { ...m, children: m.children.filter(c => has(c.perm)) } : m)
    .filter(m => {
      if (m.children) return m.children.length > 0
      return !m.perm || has(m.perm)
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
                <div key={m.label} className={`menu-dropdown${openDropdown === m.label ? ' open' : ''}`}>
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
                  className={`menu-item ${isActive(m) ? 'is-active' : ''}`}
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
              <button
                type="button"
                className="topbar-btn topbar-logout-btn"
                onClick={handleLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                {/* Desktop: chữ; mobile: chỉ icon cho gọn (ẩn/hiện qua CSS) */}
                <span className="topbar-logout-text">Đăng xuất</span>
                <svg className="topbar-logout-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
              {sectionNav && sectionNav.items?.length > 0 && (
                <div className="topbar-section-nav" ref={sectionNavRef}>
                  <button
                    type="button"
                    className="topbar-btn topbar-icon-btn topbar-section-btn"
                    title="Chọn mục trong module"
                    aria-label="Chọn mục"
                    aria-haspopup="menu"
                    aria-expanded={sectionMenuOpen}
                    onClick={() => setSectionMenuOpen(o => !o)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6"></line>
                      <line x1="4" y1="12" x2="20" y2="12"></line>
                      <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                  </button>
                  {sectionMenuOpen && (
                    <div className="topbar-section-menu" role="menu" aria-label="Chọn mục trong module">
                      {sectionNav.items.map(item => {
                        // Deptwork/Tender điều hướng theo path (base + value); trang chi tiết HĐ
                        // dùng query ?tab= nên tự cấp `to` đầy đủ cho từng mục.
                        const to = item.to || `${sectionNav.base}/${item.value}`
                        return (
                          <button
                            key={item.value}
                            type="button"
                            role="menuitem"
                            className={`topbar-section-menu-item${item.value === sectionNav.current ? ' is-active' : ''}`}
                            onClick={() => { setSectionMenuOpen(false); navigate(to) }}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className="topbar-btn topbar-icon-btn topbar-help-btn"
                title="Trợ giúp: hướng dẫn sử dụng & tra cứu nhanh"
                aria-label="Mở hướng dẫn sử dụng"
                aria-expanded={helpOpen}
                onClick={() => {
                  setMobileMenuOpen(false)
                  // Định vị trang/tab đang đứng để panel mở thẳng tới hướng dẫn tương ứng.
                  setHelpTarget(resolveHelpTarget(location.pathname, location.search, active))
                  setHelpOpen(true)
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <path d="M12 17h.01"></path>
                </svg>
              </button>
              {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} target={helpTarget} />}
              {onHome && (
                <span className="topbar-dash-switch">
                  <DashSwitcher available={available} active={active} onPick={pick} />
                </span>
              )}
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

      </div>
    </header>
  )
}
