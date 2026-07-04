// Cấu hình mục (trang con) của module KT Cơ điện — dùng chung cho sidebar (desktop) và
// nút icon chọn mục trên Header (mobile). Tách riêng khỏi component để fast-refresh sạch.
export const DEPTWORK_BASE = '/cong-viec/kt-co-dien'
export const DEPTWORK_ITEMS = [
  { label: 'Bảng công việc', section: 'board' },
  { label: 'Nhật ký công việc', section: 'logs' },
  { label: 'Năng lực', section: 'capacity' },
]
