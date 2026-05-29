export default function Header({ user, activeMenu, onNavigate, onLogout }) {
  const menus = [
    'Trang chủ',
    'Hợp đồng bán',
    'Tài liệu',
    'Các tác vụ',
    'Quản trị hệ thống',
  ]

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onNavigate('Trang chủ', 'home')}
          aria-label="Trang chủ"
        >
          <img className="brand-logo" src="/src/assets/tecapro-logo.png" alt="TECAPRO" />
        </button>

        <nav className="menu" aria-label="Chính">
          {menus.map((m) => (
            <button
              key={m}
              type="button"
              className={`menu-item ${activeMenu === m ? 'is-active' : ''}`}
              onClick={() => {
                if (m === 'Quản trị hệ thống') {
                  onNavigate(user ? 'Quản lý người dùng' : 'Quản trị hệ thống', user ? 'home' : 'login')
                } else {
                  onNavigate(m, 'home')
                }
              }}
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
              <button type="button" className="topbar-btn" onClick={onLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              className="topbar-btn"
              onClick={() => onNavigate('Quản trị hệ thống', 'login')}
            >
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
