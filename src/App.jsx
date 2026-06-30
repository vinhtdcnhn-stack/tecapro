import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { preloadRoutesOnIdle } from './lib/idlePrefetch'
import Header from './components/layout/Header'
import ChangePasswordModal from './components/auth/ChangePasswordModal'
import useLiveAlerts from './hooks/useLiveAlerts'
// HomePage (trang đích mặc định) và LoginPage nạp ngay để không chớp màn chờ lúc vào.
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import './App.css'

// Code-split các trang còn lại: bundle đầu nhẹ hơn → first paint nhanh. .preload() cho phép
// lớp idle prefetch (preloadRoutesOnIdle) tải sẵn chunk lúc trình duyệt rảnh, và hover prefetch
// tải sẵn khi người dùng tỏ ý sắp mở → chuyển trang gần như tức thì.
function lazyWithPreload(factory) {
  const Comp = lazy(factory)
  Comp.preload = factory
  return Comp
}
const QldaPage = lazyWithPreload(() => import('./pages/QldaPage'))
const QldaDetailPage = lazyWithPreload(() => import('./pages/QldaDetailPage'))
const QuantriPage = lazyWithPreload(() => import('./pages/QuantriPage'))
const DeptWorkPage = lazyWithPreload(() => import('./pages/DeptWorkPage'))
const TenderPage = lazyWithPreload(() => import('./pages/TenderPage'))
const TenderDetailPage = lazyWithPreload(() => import('./pages/TenderDetailPage'))
const MyTenderTaskPage = lazyWithPreload(() => import('./pages/MyTenderTaskPage'))
const ApprovalPage = lazyWithPreload(() => import('./pages/ApprovalPage'))
const WarrantyLookupPage = lazyWithPreload(() => import('./pages/WarrantyLookupPage'))

// Các trang được nạp sẵn lúc rảnh (sau khi đăng nhập). QldaDetailPage đứng đầu vì hay mở nhất.
const PRELOAD_ROUTES = [
  QldaPage, QldaDetailPage, ApprovalPage, DeptWorkPage,
  TenderPage, TenderDetailPage, MyTenderTaskPage, QuantriPage, WarrantyLookupPage,
]

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function Layout() {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [showChangePwModal, setShowChangePwModal] = useState(false)

  // Long-poll hợp nhất: nền đỏ cảnh báo (việc HĐ + việc phòng) và badge inbox đề xuất,
  // qua MỘT kết nối duy nhất tới server (thay 3 vòng poll định kỳ cũ).
  const { inbox: inboxCount } = useLiveAlerts(user)

  // Sau khi đăng nhập, nạp sẵn chunk các trang lúc trình duyệt rảnh → chuyển trang tức thì.
  useEffect(() => { if (user) preloadRoutesOnIdle(PRELOAD_ROUTES) }, [user])

  // Phím tắt toàn cục.
  //  • Alt+C → trang chủ, Alt+B → danh sách Hợp đồng bán (giữ nguyên).
  //  • Tổ hợp Shift+… (không giữ Alt/Ctrl/Meta, không đang gõ trong ô nhập):
  //      Shift+Z = quay lại trang trước
  //      Shift+V/P/K/Q/B/U = về trang chủ và mở dashboard tương ứng
  //        (việc của tôi / PM / kế toán / tổng quan / việc của phòng / chưa đọc).
  useEffect(() => {
    // Đang gõ trong input/textarea/select/ô soạn thảo → bỏ qua phím đơn.
    function isTyping(el) {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    // Đổi dashboard trang chủ: ghi lựa chọn (để lần mount sau đọc lại) + báo cho
    // HomePage nếu đang hiển thị (custom event), rồi điều hướng về '/'.
    function goDashboard(key) {
      try { localStorage.setItem('home_dashboard', key) } catch { /* ignore */ }
      navigate('/')
      window.dispatchEvent(new CustomEvent('home-dashboard', { detail: key }))
    }
    const DASH_BY_KEY = { v: 'assignee', p: 'pm', k: 'accounting', q: 'director', b: 'dept', u: 'unread' }
    function handleKeyDown(e) {
      // Tổ hợp Alt+… (giữ nguyên hành vi cũ).
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault()
          navigate('/')
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          navigate('/qlda')
        }
        return
      }
      // Tổ hợp Shift+…: chỉ khi giữ đúng Shift (không Alt/Ctrl/Meta) và không đang gõ.
      if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      if (isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        navigate(-1)
      } else if (DASH_BY_KEY[key]) {
        e.preventDefault()
        goDashboard(DASH_BY_KEY[key])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  async function handleChangePassword(current, next) {
    try {
      await changePassword(current, next)
      alert('Đổi mật khẩu thành công!')
      setShowChangePwModal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="shell">
      <Header onChangePassword={() => setShowChangePwModal(true)} inboxCount={inboxCount} />
      <ChangePasswordModal
        key={showChangePwModal ? 'open' : 'closed'}
        isOpen={showChangePwModal}
        onClose={() => setShowChangePwModal(false)}
        onSave={handleChangePassword}
      />
      {/* Suspense bao các route đã code-split; fallback nhẹ tránh nhảy layout khi chunk đang tải. */}
      <Suspense fallback={<div className="page" style={{ padding: 24, color: '#6b7280' }}>Đang tải…</div>}>
        <Outlet />
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tracuu" element={<RequireAuth><WarrantyLookupPage /></RequireAuth>} />
        <Route path="/giaoban" element={<HomePage />} />
        <Route path="/qlda" element={<QldaPage />} />
        <Route path="/qlda/:id" element={<QldaDetailPage />} />
        <Route
          path="/quantri"
          element={<RequireAuth><Navigate to="/quantri/users" replace /></RequireAuth>}
        />
        <Route
          path="/quantri/:section"
          element={<RequireAuth><QuantriPage /></RequireAuth>}
        />
        <Route
          path="/cong-viec/kt-co-dien"
          element={<RequireAuth><Navigate to="/cong-viec/kt-co-dien/board" replace /></RequireAuth>}
        />
        <Route
          path="/cong-viec/kt-co-dien/:section"
          element={<RequireAuth><DeptWorkPage /></RequireAuth>}
        />
        <Route
          path="/cong-viec/dau-thau"
          element={<RequireAuth><Navigate to="/cong-viec/dau-thau/list" replace /></RequireAuth>}
        />
        <Route
          path="/cong-viec/dau-thau/goi/:id"
          element={<RequireAuth><TenderDetailPage /></RequireAuth>}
        />
        <Route
          path="/cong-viec/dau-thau/:section"
          element={<RequireAuth><TenderPage /></RequireAuth>}
        />
        <Route
          path="/viec-dau-thau/:itemId"
          element={<RequireAuth><MyTenderTaskPage /></RequireAuth>}
        />
        <Route
          path="/de-xuat"
          element={<RequireAuth><Navigate to="/de-xuat/my" replace /></RequireAuth>}
        />
        <Route
          path="/de-xuat/:section"
          element={<RequireAuth><ApprovalPage /></RequireAuth>}
        />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
