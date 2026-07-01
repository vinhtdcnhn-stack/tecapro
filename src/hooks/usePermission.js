import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

// Hook lớp A — quyền toàn cục của user hiện tại (lấy từ /auth/me, gắn ở AuthContext).
// Admin (role==1) fail-open: has() luôn true. Dùng để lọc menu / nút theo RBAC.
export function usePermission() {
  const { user } = useAuth()
  return useMemo(() => {
    const isAdmin = Number(user?.role) === 1
    const set = new Set(user?.permissions || [])
    return {
      isAdmin,
      permissions: user?.permissions || [],
      has: (key) => isAdmin || set.has(key),
      hasAny: (keys) => isAdmin || keys.some(k => set.has(k)),
    }
  }, [user])
}
