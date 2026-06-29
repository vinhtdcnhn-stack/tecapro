import { useAuth } from '../context/AuthContext'
import { useContracts, useCustomers, useUsers } from '../lib/queries'
import { useHomeDashboards } from '../lib/useHomeDashboards'
import { getBrand } from '../config/brand'
import fallbackHero from '../assets/home-hero.png'
import Dashboard from './Dashboard'
import PMDashboard from './PMDashboard'
import AssigneeDashboard from './AssigneeDashboard'
import DeptWorkDashboard from './DeptWorkDashboard'
import UnreadDashboard from './UnreadDashboard'
import AccountingDashboard from './AccountingDashboard'
import TenderDashboard from './TenderDashboard'
import DashSwitcher from './DashSwitcher'
import './accounting/Accounting.css'

export default function HomePage() {
  const { user } = useAuth()
  // Danh sách bảng điều khiển khả dụng + bảng đang chọn dùng chung với Header (nút đổi
  // bảng trên mobile). App.jsx phát 'home-dashboard' cho các phím tắt; hook đã lắng nghe.
  const { available, active, pick, isDirector } = useHomeDashboards()

  // Dữ liệu trang chủ qua TanStack Query — chính là HOT_QUERIES đã nạp sẵn lúc rảnh nên
  // dashboard thường hiện NGAY. /contracts đã lọc theo thành viên (biết user có dự án không).
  // customers/users chỉ Giám đốc mới cần (bảng tổng quan hệ thống).
  const dirEnabled = !!user && isDirector
  const { data: contracts = [], isLoading: cLoading } = useContracts({ enabled: !!user })
  const { data: customers = [], isLoading: cuLoading } = useCustomers({ enabled: dirEnabled })
  const { data: users = [], isLoading: uLoading } = useUsers({ enabled: dirEnabled })
  const loaded = !!user && !cLoading && !cuLoading && !uLoading

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

  const switcher = <DashSwitcher available={available} active={active} onPick={pick} />

  const render = () => {
    switch (active) {
      case 'director':   return <Dashboard switcher={switcher} user={user} contracts={contracts} customers={customers} users={users} />
      case 'accounting': return <AccountingDashboard switcher={switcher} user={user} />
      case 'tender':     return <TenderDashboard switcher={switcher} user={user} />
      case 'dept':       return <DeptWorkDashboard switcher={switcher} user={user} />
      case 'assignee':   return <AssigneeDashboard switcher={switcher} user={user} />
      case 'unread':     return <UnreadDashboard switcher={switcher} user={user} />
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
