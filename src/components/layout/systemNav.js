// Cấu hình các mục trong module "Hệ thống" (Quản trị) — NGUỒN DÙNG CHUNG cho:
//  • Sidebar.jsx (danh sách dọc khi đã vào trang /quantri)
//  • BottomNav.jsx (menu bung từ ô "Hệ thống" trên thanh đáy mobile)
// Tách ra đây để hai chỗ không lệch nhau khi thêm/bớt mục.
export const SYSTEM_GROUPS = [
  {
    category: 'I. Danh mục',
    items: [
      { label: 'QUẢN LÝ NGƯỜI DÙNG',    section: 'users',       viewPerm: 'system.users.view' },
      { label: 'QUẢN LÝ PHÒNG BAN',     section: 'departments', viewPerm: 'system.departments.view' },
      { label: 'QUẢN LÝ VỊ TRÍ',        section: 'positions',   viewPerm: 'system.positions.view' },
      { label: 'QUẢN LÝ KHÁCH HÀNG',    section: 'customers',   viewPerm: 'system.customers.view' },
      { label: 'QUẢN LÝ NHÀ CUNG CẤP',  section: 'suppliers',   viewPerm: 'system.suppliers.view' },
      { label: 'QUẢN LÝ LOẠI BIÊN BẢN', section: 'bb-types',    viewPerm: 'system.bbtypes.view' },
    ],
  },
  {
    category: 'II. Quản trị hệ thống',
    items: [
      { label: 'PHÂN QUYỀN',          section: 'phan-quyen',          adminOnly: true },
      { label: 'SAO LƯU / KHÔI PHỤC', section: 'backup',              adminOnly: true },
      { label: 'NHẬT KÝ THAY ĐỔI',    section: 'nhat-ky-thay-doi',    adminOnly: true },
      { label: 'NHẬT KÝ TELEGRAM',    section: 'telegram-log',        adminOnly: true },
      { label: 'CHẨN ĐOÁN HIỆU NĂNG', section: 'chan-doan-hieu-nang', adminOnly: true },
    ],
  },
  {
    category: 'III. Khác',
    items: [
      { label: 'GÓP Ý CẢI THIỆN', section: 'feedback' },
    ],
  },
]

// Lọc theo quyền (RBAC lớp A): adminOnly cần isAdmin, viewPerm cần has(perm). Bỏ nhóm rỗng.
export function filterSystemGroups({ has, isAdmin }) {
  return SYSTEM_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        if (item.viewPerm && !has(item.viewPerm)) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)
}
