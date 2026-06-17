// Helper/hằng số dùng chung cho module Đề xuất / Phê duyệt.

// Trạng thái đơn → nhãn + class badge (tái dùng style status-badge trong index.css).
export const REQUEST_STATUS = {
  draft:     { label: 'Nháp',        cls: 'status-draft' },
  pending:   { label: 'Chờ duyệt',   cls: 'status-pending' },
  approved:  { label: 'Đã duyệt',    cls: 'status-completed' },
  rejected:  { label: 'Từ chối',     cls: 'status-cancelled' },
  cancelled: { label: 'Đã hủy',      cls: 'status-cancelled' },
}

export function statusInfo(status) {
  return REQUEST_STATUS[status] || { label: status || '', cls: '' }
}

// Các kiểu trường form builder hỗ trợ.
export const FIELD_TYPES = [
  { value: 'text',       label: 'Văn bản ngắn' },
  { value: 'textarea',   label: 'Văn bản dài' },
  { value: 'number',     label: 'Số' },
  { value: 'money',      label: 'Số tiền' },
  { value: 'date',       label: 'Ngày' },
  { value: 'date_range', label: 'Khoảng ngày' },
  { value: 'select',     label: 'Chọn một' },
  { value: 'checkbox',   label: 'Có / Không' },
  { value: 'user',       label: 'Nhân viên' },
  { value: 'file',       label: 'Tệp đính kèm' },
  { value: 'table',      label: 'Bảng (nhiều dòng)' },
]

// Kiểu cột trong trường "Bảng" (tập con đơn giản, không lồng bảng/tệp).
export const TABLE_COLUMN_TYPES = [
  { value: 'text',   label: 'Văn bản' },
  { value: 'number', label: 'Số' },
  { value: 'money',  label: 'Số tiền' },
  { value: 'date',   label: 'Ngày' },
]

// Quy tắc bước duyệt khi có nhiều người duyệt.
export const STEP_RULES = {
  any: 'Một người duyệt là đủ',
  all: 'Cần tất cả cùng duyệt',
}

// Nguồn người duyệt của một bước.
export const APPROVER_SOURCES = {
  fixed: 'Cố định (chọn sẵn người)',
  direct_manager: 'Quản lý trực tiếp người gửi',
  requester_pick: 'Người gửi tự chọn',
}

// Điều kiện áp dụng bước theo chức danh người gửi (bước không hợp điều kiện sẽ bị bỏ lúc gửi).
export const CONDITION_MODES = {
  always: 'Luôn áp dụng',
  include: 'Chỉ các chức danh…',
  exclude: 'Trừ các chức danh…',
}

// Người dùng hiện tại có quyền quản trị form builder không (chỉ admin).
export function canManageForms(user) {
  return Number(user?.role) === 1
}

// Loại tiền hỗ trợ cho trường/cột "Số tiền".
export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'SGD', 'GBP', 'THB', 'KRW', 'AUD']

// Nhãn ngắn hiển thị cạnh số tiền.
export function curLabel(cur = 'VND') {
  return cur === 'VND' ? '₫' : (cur || '')
}

// Định dạng số tiền kèm loại tiền (VND: số nguyên + ₫; ngoại tệ: 2 số lẻ + mã).
export function fmtMoney(v, cur = 'VND') {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  const num = n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
  return `${num} ${curLabel(cur)}`
}
