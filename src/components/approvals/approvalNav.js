// Cấu hình mục (trang con) của module Đề xuất / Phê duyệt — dùng chung cho sidebar (desktop)
// và nút icon chọn mục trên Header (mobile). Tách riêng khỏi component để fast-refresh sạch.
export const APPROVAL_BASE = '/de-xuat'
export const APPROVAL_GROUPS = [
  {
    category: 'I. Đề xuất của tôi',
    items: [
      { label: 'Đơn của tôi', section: 'my' },
      { label: 'Chờ tôi duyệt', section: 'inbox' },
      { label: 'Sắp đến lượt tôi', section: 'upcoming' },
      { label: 'Tôi theo dõi', section: 'following' },
    ],
  },
  {
    category: 'II. Quản trị',
    items: [
      { label: 'Tất cả đề xuất', section: 'all', adminOnly: true },
      { label: 'Loại đơn', section: 'forms', adminOnly: true },
    ],
  },
]
