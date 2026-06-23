import { useState, useEffect } from 'react'
import { API_BASE as API } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { getBrand } from '../config/brand'
import fallbackHero from '../assets/home-hero.png'
import Dashboard from './Dashboard'
import PMDashboard from './PMDashboard'
import AssigneeDashboard from './AssigneeDashboard'
import AccountingDashboard from './AccountingDashboard'
import TenderDashboard from './TenderDashboard'
import DashSwitcher from './DashSwitcher'
import './accounting/Accounting.css'

const STORE_KEY = 'home_dashboard'

export default function HomePage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState(null)

  // Vai trò → các dashboard khả dụng. Một user có thể giữ nhiều vị trí (nhiều vai).
  const codes = new Set([
    ...(user?.positions?.map(p => p.code) || []),
    user?.position_code,
  ].filter(Boolean))
  const hasPMPosition = codes.has('PM_TEAM')
  const isDirector    = codes.has('GD') || codes.has('PGD')
  const isAdmin       = Number(user?.role) === 1
  const isAccountant  = user?.department_name === 'Ban Kế Toán'
  const isTenderPlanner = Number(user?.department_id) === 9

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        // /api/contracts đã lọc theo thành viên cho non-admin → biết user có tham gia dự án không.
        const c = await fetch(`${API}/api/contracts`).then(r => r.json())
        if (cancelled) return
        setContracts(Array.isArray(c) ? c : [])
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
  }, [user, isDirector])

  if (!user) {
    return (
      <main className="page page--home">
        <div className="home-hero">
          <img
            className="home-hero-img"
            src={getBrand().hero || fallbackHero}
            alt=""
            onError={(e) => { e.currentTarget.src = fallbackHero }}
          />
        </div>
      </main>
    )
  }

  if (!loaded) {
    return (
      <main className="page admin-page dash-page">
        <div className="dashboard"><p className="dash-empty">Đang tải...</p></div>
      </main>
    )
  }

  // ── Danh sách dashboard khả dụng (sau khi biết membership) ──
  const canPM = hasPMPosition || contracts.length > 0
  const available = []
  if (canPM)                                  available.push({ key: 'pm',        label: 'Tiến độ dự án' })
  if (isDirector)                             available.push({ key: 'director',  label: 'Tổng quan hệ thống' })
  if (isAccountant || isDirector || isAdmin)  available.push({ key: 'accounting', label: 'Kế toán' })
  if (isTenderPlanner)                        available.push({ key: 'tender',     label: 'Kế hoạch đấu thầu' })
  // "Việc của tôi" luôn khả dụng: gom mọi việc giao trực tiếp (gồm việc đấu thầu giao
  // cho người ngoài Ban Đấu thầu) với cửa sổ thời hạn không giới hạn → không bỏ sót.
  available.push({ key: 'assignee', label: 'Việc của tôi' })

  // Mặc định theo thứ tự ưu tiên cũ; nhớ lựa chọn người dùng nếu còn hợp lệ.
  const defaultKey = canPM ? 'pm' : isDirector ? 'director' : isAccountant ? 'accounting'
    : isTenderPlanner ? 'tender' : 'assignee'
  const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORE_KEY) : null
  const keys = available.map(a => a.key)
  const active = (selected && keys.includes(selected)) ? selected
    : (stored && keys.includes(stored)) ? stored
    : (keys.includes(defaultKey) ? defaultKey : keys[0])

  const pick = (key) => {
    setSelected(key)
    try { localStorage.setItem(STORE_KEY, key) } catch { /* ignore */ }
  }

  const switcher = <DashSwitcher available={available} active={active} onPick={pick} />

  const render = () => {
    switch (active) {
      case 'director':   return <Dashboard switcher={switcher} user={user} contracts={contracts} customers={customers} users={users} />
      case 'accounting': return <AccountingDashboard switcher={switcher} user={user} />
      case 'tender':     return <TenderDashboard switcher={switcher} user={user} />
      case 'assignee':   return <AssigneeDashboard switcher={switcher} user={user} />
      case 'pm':
      default:           return <PMDashboard switcher={switcher} user={user} />
    }
  }

  return (
    <main className="page admin-page dash-page">
      {render()}
    </main>
  )
}
