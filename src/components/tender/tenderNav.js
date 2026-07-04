// Cấu hình mục (trang con) của module Kế hoạch Đấu thầu — dùng chung cho sidebar (desktop)
// và nút icon chọn mục trên Header (mobile). Tách riêng khỏi component để fast-refresh sạch.
export const TENDER_BASE = '/cong-viec/dau-thau'
export const TENDER_ITEMS = [
  { label: 'Danh sách gói', section: 'list' },
  { label: 'Việc của tôi', section: 'my' },
  { label: 'Mẫu checklist', section: 'template', headOnly: true },
  { label: 'Báo cáo', section: 'reports' },
]
