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
    const userId = localStorage.getItem('userId')
    if (!userId) { setAuthLoading(false); return }
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/me/${userId}`)
        if (!res.ok) {
          localStorage.removeItem('userId')
        } else {
          const data = await res.json()
          setUser({
            ...data,
            position_code: data.positions?.[0]?.code || null,
            position_name: data.positions?.map(p => p.name).join(', ') || null,
          })
        }
      } catch {
        localStorage.removeItem('userId')
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
    localStorage.setItem('userId', data.id)
  }

  function logout() {
    localStorage.removeItem('userId')
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
