import { useState, useEffect } from 'react'
import { API_BASE as API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import homeHero from '../assets/home-hero.png'
import Dashboard from './Dashboard'
import PMDashboard from './PMDashboard'


export default function HomePage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [loaded, setLoaded] = useState(false)

  // Dashboard chọn theo VỊ TRÍ trước (bảng position), cá nhân sau:
  //   PM_TEAM            → bảng theo dõi tiến độ dự án (PMDashboard)
  //   GD / PGD (giám đốc)→ dashboard tổng quan (Dashboard)
  //   còn lại            → nếu là thành viên ≥1 dự án thì cũng dùng PMDashboard
  const codes = new Set([
    ...(user?.positions?.map(p => p.code) || []),
    user?.position_code,
  ].filter(Boolean))
  const hasPMPosition = codes.has('PM_TEAM')
  const isDirector    = codes.has('GD') || codes.has('PGD')

  useEffect(() => {
    if (!user) return
    // PM_TEAM render PMDashboard (tự nạp /api/pm/:id/dashboard) → KHÔNG dùng
    // contracts/customers/users. Bỏ qua các fetch này để chúng không tranh
    // connection pool/băng thông với request dashboard, tránh làm trang chủ chờ.
    if (hasPMPosition) return // nhánh PM render trước khi đọc `loaded` → không cần set
    let cancelled = false
    ;(async () => {
      try {
        // /api/contracts đã lọc theo thành viên cho non-admin → dùng để biết user có tham gia dự án không.
        const c = await fetch(`${API}/api/contracts`).then(r => r.json())
        if (cancelled) return
        setContracts(Array.isArray(c) ? c : [])
        // Chỉ Dashboard tổng quan (GD/PGD) mới cần thêm khách hàng + nhân sự.
        if (isDirector) {
          const [cu, u] = await Promise.all([
            fetch(`${API}/api/customers`).then(r => r.json()),
            fetch(`${API}/api/users`).then(r => r.json()),
          ])
          if (!cancelled) {
            setCustomers(Array.isArray(cu) ? cu : [])
            setUsers(Array.isArray(u) ? u : [])
          }
        }
      } catch (err) {
        console.error('Failed to load home data:', err)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [user, hasPMPosition, isDirector])

  if (!user) {
    return (
      <main className="page page--home">
        <div className="home-hero">
          <img className="home-hero-img" src={homeHero} alt="" />
        </div>
      </main>
    )
  }

  // ── Ưu tiên theo vị trí ──
  if (hasPMPosition) {
    return (
      <main className="page admin-page dash-page">
        <PMDashboard user={user} />
      </main>
    )
  }

  if (isDirector) {
    return (
      <main className="page admin-page dash-page">
        <Dashboard user={user} contracts={contracts} customers={customers} users={users} />
      </main>
    )
  }

  // ── Sau đó theo cá nhân: thành viên dự án (bất kỳ vai trò) cũng dùng dashboard tiến độ ──
  // Chờ tải xong danh sách HĐ (đã lọc theo thành viên) mới quyết định, tránh nhấp nháy.
  if (!loaded) {
    return (
      <main className="page admin-page dash-page">
        <div className="dashboard"><p className="dash-empty">Đang tải...</p></div>
      </main>
    )
  }

  if (contracts.length > 0) {
    return (
      <main className="page admin-page dash-page">
        <PMDashboard user={user} />
      </main>
    )
  }

  return (
    <main className="page page--home">
      <div className="home-hero">
        <img className="home-hero-img" src={homeHero} alt="" />
      </div>
    </main>
  )
}
