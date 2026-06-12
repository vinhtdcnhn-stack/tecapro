import { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE as API } from '../config/api'

const AuthContext = createContext(null)
// Hook co-located with its provider; only affects dev hot-reload, not the build.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    // Khôi phục phiên từ cookie httpOnly (server xác định danh tính, client không tự khai id).
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`)
        if (res.ok) {
          const data = await res.json()
          setUser({
            ...data,
            position_code: data.positions?.[0]?.code || null,
            position_name: data.positions?.map(p => p.name).join(', ') || null,
          })
        }
      } catch {
        /* chưa đăng nhập */
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [])

  async function login(email, password) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? 'Đăng nhập thất bại.')
    setUser({
      id:              data.id,
      email:           data.email,
      full_name:       data.full_name,
      role:            data.role,
      department_id:   data.department_id   || null,
      department_code: data.department_code || null,
      department_name: data.department_name || null,
      positions:       data.positions       || [],
      position_code:   data.position_code   || null,
      position_name:   data.position_name   || null,
    })
    // Phiên được giữ bằng cookie httpOnly do server đặt — không lưu gì nhạy cảm ở client.
  }

  async function logout() {
    try { await fetch(`${API}/api/auth/logout`, { method: 'POST' }) } catch { /* ignore */ }
    setUser(null)
  }

  async function changePassword(currentPassword, newPassword) {
    const res = await fetch(`${API}/api/users/${user.id}/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Đổi mật khẩu thất bại!')
  }

  return (
    <AuthContext.Provider value={{ user, authLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}
