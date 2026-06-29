import { API_BASE } from '../config/api'

// Bộ nhớ validator cho conditional GET (xác thực nhẹ): url -> { etag, body }. Ở mức module
// nên sống xuyên suốt các lần mount/điều hướng → lần ghé thứ 2 gửi If-None-Match; nếu server
// trả 304 (dữ liệu chưa đổi) thì trả lại body đã lưu, KHÔNG tải/parse lại payload. Chỉ áp cho
// request bật { conditional: true } (các endpoint đọc-only đã version-namespace ở backend —
// xem server/services/cacheKeys.js reportNotModified). Số URL báo cáo có hạn nên Map nhỏ.
const condStore = new Map()

// Trình lấy dữ liệu GET dùng chung cho mọi query. Cookie phiên (httpOnly) đã được
// fetchSetup.js tự đính kèm (credentials:'include'), nên ở đây không cần khai báo lại.
// `path` bắt đầu bằng '/...' và sẽ được ghép sau '/api' — ví dụ apiGet('/contracts').
//
// { conditional: true } bật xác thực nhẹ: bỏ HTTP cache trình duyệt (cache:'no-store') để
// If-None-Match thủ công là nguồn quyết định duy nhất và 304 trả thẳng về đây.
export async function apiGet(path, { conditional = false } = {}) {
  const url = `${API_BASE}/api${path}`
  const opts = conditional ? { cache: 'no-store', headers: {} } : {}
  const prev = conditional ? condStore.get(url) : null
  if (prev) opts.headers['If-None-Match'] = prev.etag

  const res = await fetch(url, opts)
  if (res.status === 304 && prev) return prev.body  // chưa đổi → dùng lại bản đã cache
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)

  const body = await res.json()
  if (conditional) {
    const etag = res.headers.get('ETag')
    if (etag) condStore.set(url, { etag, body })
  }
  return body
}

// Xóa toàn bộ validator điều kiện. PHẢI gọi khi đăng xuất: các endpoint per-user (vd
// /contracts, /tender/my) chia sẻ ETag toàn cục nên nếu giữ lại body của user cũ, lần ghé
// sau (user mới cùng tab) có thể bị trả 304 + body cũ. Xóa kho → buộc tải mới cho user mới.
export function clearConditionalCache() {
  condStore.clear()
}
