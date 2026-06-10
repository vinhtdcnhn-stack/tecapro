// Shared constants, style helpers & formatters for the contract-in tab.

export const CURRENCIES     = ['VND', 'USD', 'EUR', 'JPY', 'CNY']
export const PURCHASE_TYPES = ['Trong nước', 'Nhập khẩu']
export const STATUSES       = ['Active', 'Completed', 'Cancelled']

export const SUB_TABS = [
  { key: 'info',        label: 'Thông tin' },
  { key: 'documents',   label: 'Tài liệu' },
  { key: 'pricing',     label: 'Bảng giá mua' },
  { key: 'delivery',    label: 'Nhận hàng' },
  { key: 'serials',     label: 'Quản lý Serial' },
  { key: 'payment',     label: 'Thanh toán' },
  { key: 'progress',    label: 'Tiến độ theo BB' },
  { key: 'warranty',    label: 'Bảo hành NCC' },
  { key: 'guarantee',   label: 'Bảo lãnh' },
  { key: 'customs',     label: 'Xuất nhập khẩu' },
  { key: 'logistics',   label: 'Theo dõi logistics' },
]

export const thStyle = (w, align = 'left') => ({
  padding: '9px 12px', textAlign: align, fontSize: 11, fontWeight: 600,
  color: '#4b5563', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  width: w, minWidth: w,
})
export const tdStyle = (align = 'left', extra = {}) => ({
  padding: '10px 12px', textAlign: align, borderBottom: '1px solid #f3f4f6',
  fontSize: 13, verticalAlign: 'middle', whiteSpace: 'nowrap', ...extra,
})

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '-'
// VND: làm tròn về số nguyên (không hiện thập phân). Ngoại tệ: tối đa 2 số lẻ.
export const fmtNum  = (n, currency = 'VND') => {
  if (n === null || n === undefined) return '-'
  let num = parseFloat(n) || 0
  if (currency === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(num))
  num = Math.round(num * 100) / 100
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num)
}

export const statusCfg = {
  Active:    { label: 'Đang thực hiện', cls: 'status-active' },
  Completed: { label: 'Hoàn thành',     cls: 'status-completed' },
  Cancelled: { label: 'Hủy bỏ',         cls: 'status-cancelled' },
}
