import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Header from './components/layout/Header'
import ChangePasswordModal from './components/auth/ChangePasswordModal'
import useDeptWorkAlert from './components/deptwork/useDeptWorkAlert'
import useContractTaskAlert from './components/contracts/useContractTaskAlert'
import HomePage from './pages/HomePage'
import QldaPage from './pages/QldaPage'
import QldaDetailPage from './pages/QldaDetailPage'
import QuantriPage from './pages/QuantriPage'
import DeptWorkPage from './pages/DeptWorkPage'
import TenderPage from './pages/TenderPage'
import TenderDetailPage from './pages/TenderDetailPage'
import MyTenderTaskPage from './pages/MyTenderTaskPage'
import ApprovalPage from './pages/ApprovalPage'
import WarrantyLookupPage from './pages/WarrantyLookupPage'
import LoginPage from './pages/LoginPage'
import './App.css'

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

  // Nền toàn trang chuyển đỏ khi có báo cáo/chỉ đạo công việc phòng chưa đọc.
  useDeptWorkAlert(user)
  // Tương tự cho công việc hợp đồng (việc của user là PM/người tạo/người được giao).
  useContractTaskAlert(user)

  // Phím tắt toàn cục: Alt+C quay về trang chủ, Alt+B về danh sách Hợp đồng bán.
  useEffect(() => {
    function handleKeyDown(e) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        navigate('/')
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        navigate('/qlda')
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
      <Header onChangePassword={() => setShowChangePwModal(true)} />
      <ChangePasswordModal
        key={showChangePwModal ? 'open' : 'closed'}
        isOpen={showChangePwModal}
        onClose={() => setShowChangePwModal(false)}
        onSave={handleChangePassword}
      />
      <Outlet />
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
