import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useContracts } from './queries'

const STORE_KEY = 'home_dashboard'

// Nguồn dùng chung cho danh sách "bảng điều khiển trang chủ" khả dụng theo vai trò của
// user, bảng đang chọn, và hàm đổi bảng. Trước đây logic này nằm gọn trong HomePage; tách
// ra để Header (nút đổi bảng trên mobile, thay cho ô tra cứu) dùng lại cùng một nguồn.
// Mọi instance đều lắng nghe sự kiện 'home-dashboard' nên khi đổi ở Header thì HomePage
// (và ngược lại) tự đồng bộ. App.jsx cũng phát sự kiện này cho các phím tắt v/p/k/q/b.
export function useHomeDashboards() {
  const { user } = useAuth()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    function onSwitch(e) { setSelected(e.detail) }
    window.addEventListener('home-dashboard', onSwitch)
    return () => window.removeEventListener('home-dashboard', onSwitch)
  }, [])

  // /contracts đã lọc theo thành viên → biết user có đang tham gia dự án nào không (để mở
  // bảng "Tiến độ dự án"). Query đã nằm trong HOT_QUERIES nên dùng lại từ cache, không fetch thêm.
  const { data: contracts = [] } = useContracts({ enabled: !!user })

  // Một user có thể giữ nhiều vị trí (nhiều vai).
  const codes = new Set([
    ...(user?.positions?.map(p => p.code) || []),
    user?.position_code,
  ].filter(Boolean))
  const hasPMPosition = codes.has('PM_TEAM')
  const isDirector    = codes.has('GD') || codes.has('PGD')
  const isDeptHead    = codes.has('TP') || codes.has('PP')   // Trưởng/Phó ban → xem việc cả phòng
  const isAdmin       = Number(user?.role) === 1
  const isAccountant  = user?.department_name === 'Ban Kế Toán'
  const isTenderPlanner = Number(user?.department_id) === 9

  const canPM = hasPMPosition || contracts.length > 0
  const available = []
  if (canPM)                                  available.push({ key: 'pm',         label: 'Tiến độ dự án' })
  if (isDirector)                             available.push({ key: 'director',   label: 'Tổng quan hệ thống' })
  if (isAccountant || isDirector || isAdmin)  available.push({ key: 'accounting', label: 'Kế toán' })
  if (isTenderPlanner)                        available.push({ key: 'tender',     label: 'Kế hoạch đấu thầu' })
  if (isDeptHead)                             available.push({ key: 'dept',       label: 'Việc của phòng' })
  // "Việc của tôi" luôn khả dụng: gom mọi việc giao trực tiếp với cửa sổ thời hạn không giới hạn.
  available.push({ key: 'assignee', label: 'Việc của tôi' })

  // Mặc định theo thứ tự ưu tiên cũ; nhớ lựa chọn người dùng nếu còn hợp lệ.
  const defaultKey = canPM ? 'pm' : isDirector ? 'director' : isAccountant ? 'accounting'
    : isTenderPlanner ? 'tender' : 'assignee'
  const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORE_KEY) : null
  const keys = available.map(a => a.key)
  const active = (selected && keys.includes(selected)) ? selected
    : (stored && keys.includes(stored)) ? stored
    : (keys.includes(defaultKey) ? defaultKey : keys[0])

  // Ghi lựa chọn rồi phát sự kiện để mọi instance (và HomePage) cùng cập nhật.
  const pick = (key) => {
    try { localStorage.setItem(STORE_KEY, key) } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('home-dashboard', { detail: key }))
  }

  return { available, active, pick, isDirector }
}
