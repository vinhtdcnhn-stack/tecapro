import { API_BASE } from '../config/api'

// Trình lấy dữ liệu GET dùng chung cho mọi query. Cookie phiên (httpOnly) đã được
// fetchSetup.js tự đính kèm (credentials:'include'), nên ở đây không cần khai báo lại.
// `path` bắt đầu bằng '/...' và sẽ được ghép sau '/api' — ví dụ apiGet('/contracts').
export async function apiGet(path) {
  const res = await fetch(`${API_BASE}/api${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}
