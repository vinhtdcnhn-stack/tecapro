export default function Sidebar({ activeMenu, onNavigate }) {
  return (
    <aside className="sidebar">
      <button
        className={`sidebar-btn ${activeMenu === 'Quản lý người dùng' ? 'active' : ''}`}
        onClick={() => onNavigate('Quản lý người dùng')}
      >
        QUẢN LÝ NGƯỜI DÙNG
      </button>

      <button
        className={`sidebar-btn ${activeMenu === "departments" ? "active" : ""}`}
        onClick={() => onNavigate("departments")}
      >
        QUẢN LÝ PHÒNG BAN
      </button>

      <button
        className={`sidebar-btn ${activeMenu === "positions" ? "active" : ""}`}
        onClick={() => onNavigate("positions")}
      >
        QUẢN LÝ VỊ TRÍ
      </button>

      <button
        className={`sidebar-btn ${activeMenu === "customers" ? "active" : ""}`}
        onClick={() => onNavigate("customers")}
      >
        QUẢN LÝ KHÁCH HÀNG
      </button>

      <button
        className={`sidebar-btn ${activeMenu === "suppliers" ? "active" : ""}`}
        onClick={() => onNavigate("suppliers")}
      >
        QUẢN LÝ NHÀ CUNG CẤP
      </button>
    </aside>
  )
}
