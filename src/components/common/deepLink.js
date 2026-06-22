// Tạo & phân giải "đường dẫn sâu" tới chi tiết hợp đồng — dùng cho tính năng
// "Sao chép thông tin" (nhúng link điều hướng) và ô tra cứu trên thanh tiêu đề
// (dán link để nhảy tới đúng vị trí: tab công nợ / việc / bảo hành / HĐ nhập...).

const origin = () => (typeof window !== 'undefined' && window.location?.origin) || ''

// Path nội bộ tới đúng tab trong chi tiết HĐ bán. Khớp useContractNav / openContract.
//   tab    — menu HĐ bán: 'contract-debt', 'contract-tasks', 'contract-warranty', ...
//   inId   — id HĐ nhập cần mở (khi tab = 'purchase-contract-info')
//   inTab  — sub-tab HĐ nhập: 'payment', ...
//   taskId — id công việc cần nhảy tới & làm nổi bật (khi tab = 'contract-tasks')
// Trả null nếu thiếu contractOutId (hàng không gắn HĐ → không có link để dán).
export function contractPath(contractOutId, { tab, inId, inTab, taskId } = {}) {
  if (!contractOutId) return null
  const qs = new URLSearchParams()
  if (tab) qs.set('tab', tab)
  if (inId) qs.set('inId', String(inId))
  if (inTab) qs.set('inTab', inTab)
  if (taskId) qs.set('taskId', String(taskId))
  const s = qs.toString()
  return `/qlda/${contractOutId}${s ? `?${s}` : ''}`
}

// URL tuyệt đối (gồm origin) để dán cho người khác mở trực tiếp.
export function absUrl(path) {
  return path ? `${origin()}${path}` : ''
}

// Trích đường dẫn điều hướng nội bộ từ đoạn văn bản đã sao chép (hoặc URL dán vào ô tra
// cứu). Ưu tiên dòng có dấu 🔗 do app sinh ra; nếu không, bắt URL tuyệt đối hoặc path
// "/..." trong văn bản. Trả path nội bộ (giữ nguyên query) cho react-router, hoặc null.
export function parseDeepLink(text) {
  const t = String(text || '')
  // 1) Dòng "🔗 <url|path>" — định dạng chuẩn app chèn vào.
  let raw = t.match(/🔗\s*(\S+)/)?.[1]
  // 2) Dán URL tuyệt đối hoặc path nội bộ trần.
  if (!raw) raw = t.match(/https?:\/\/\S+/)?.[0] || t.match(/\/qlda\/\d+(?:\?\S*)?/)?.[0]
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    try { const u = new URL(raw); return u.pathname + u.search } catch { return null }
  }
  return raw.startsWith('/') ? raw : null
}
