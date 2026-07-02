import { apiGet } from '../../../lib/api'
import { API_BASE } from '../../../config/api'

// Gọi API chẩn đoán hiệu năng / gợi ý cache (chỉ admin).

// Lớp ①: route đọc theo tải. { cacheReady, since, thresholds, rows[] }
export function fetchHints({ minP95, minCount } = {}) {
  const qs = new URLSearchParams()
  if (minP95) qs.set('minP95', minP95)
  if (minCount) qs.set('minCount', minCount)
  const q = qs.toString()
  return apiGet(`/admin/cache-hints${q ? `?${q}` : ''}`)
}

// Đặt lại bộ đếm in-memory. Dùng fetch thô (global wrapper đã thêm credentials).
export async function resetHints() {
  const res = await fetch(`${API_BASE}/api/admin/cache-hints/reset`, { method: 'POST' })
  if (!res.ok) throw new Error('Không đặt lại được bộ đếm.')
  return res.json()
}

// Lớp ②: top query đắt từ pg_stat_statements. { available, rows[] } | { available:false, hint }
export function fetchSlowQueries(limit = 30) {
  return apiGet(`/admin/slow-queries?limit=${limit}`)
}

// Tab ⓪: tổng quan sức khỏe hệ thống (phần cứng/OS + Postgres/Redis + tiến trình + số liệu app).
export function fetchSystemHealth() {
  return apiGet('/admin/system-health')
}
