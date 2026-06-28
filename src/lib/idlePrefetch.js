import { queryClient } from './queryClient'
import { HOT_QUERIES, qk, fetchers } from './queries'

// Chạy `cb` khi luồng chính rảnh. requestIdleCallback có ở Chrome/Edge/Firefox; Safari
// chưa hỗ trợ → lùi về setTimeout ngắn. `timeout` đảm bảo không bị hoãn vô hạn nếu máy bận.
export function onIdle(cb, timeout = 2000) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(cb, { timeout })
  }
  return setTimeout(cb, 200)
}

// Lớp 2 — Nạp sẵn dữ liệu dùng chung lúc rảnh, sau khi đã đăng nhập.
// prefetchQuery chỉ gọi mạng nếu cache chưa có / đã cũ, nên gọi lại nhiều lần vẫn an toàn.
export function prefetchHotData() {
  for (const q of HOT_QUERIES) {
    onIdle(() => { queryClient.prefetchQuery(q) })
  }
}

// Lớp 3 — Nạp sẵn chi tiết một bản ghi (khi người dùng rê chuột / chạm vào dòng).
// Gọi ngay (không chờ idle) vì đây là tín hiệu chủ đích sắp mở trang đó.
export function prefetchContract(id) {
  if (id == null || id === '' || Number.isNaN(Number(id))) return
  queryClient.prefetchQuery({ queryKey: qk.contract(id), queryFn: () => fetchers.contract(id) })
}

export function prefetchTender(id) {
  if (id == null || id === '' || Number.isNaN(Number(id))) return
  queryClient.prefetchQuery({ queryKey: qk.tender(id), queryFn: () => fetchers.tender(id) })
}

// Nạp sẵn (tải về, biên dịch) các route chunk đã code-split lúc trình duyệt rảnh.
// `comps` là các component lazy có gắn .preload() (xem lazyWithPreload trong App.jsx).
export function preloadRoutesOnIdle(comps) {
  for (const comp of comps) {
    if (comp && typeof comp.preload === 'function') {
      onIdle(() => { comp.preload() })
    }
  }
}
