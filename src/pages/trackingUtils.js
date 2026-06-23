// Helpers dùng chung cho bảng theo dõi mốc/công việc (PMDashboard & AssigneeDashboard).

// Chỉ hiển thị mốc đến hạn trong vòng N ngày tới (mốc quá hạn vẫn luôn hiện)
export const WINDOW_DAYS = 30

export const todayISO = () => new Date(new Date().toDateString()).toISOString().slice(0, 10)
export const addDays = (isoDate, n) => { const d = new Date(isoDate); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000) // a - b
export const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(parseFloat(n) || 0))
export const fmtUsd = (n) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(parseFloat(n) || 0)

export const KIND_META = {
  'Biên bản':     'kind-progress',
  'Công nợ':      'kind-receivable',
  'Bảo lãnh':     'kind-guarantee',
  'Công việc':    'kind-task',
  'Phải trả':     'kind-payable',
  'Nhận hàng':    'kind-delivery',
  'Logistics':    'kind-logistics',
  'Bảo hành NCC': 'kind-supwarranty',
}

// Ngày nhắc hiệu lực: do user đặt, hoặc mặc định = hạn − 7 ngày
export const effRemind = (it) => it.remind_at || (it.due_date ? addDays(it.due_date, -7) : null)

// Mốc thuộc phía bán → menu sidebar của HĐ bán
const SELL_MENU = {
  progress:   'contract-progress',
  receivable: 'contract-debt',
  guarantee:  'contract-guarantee',
  task:       'contract-tasks',
}
// Mốc thuộc phía nhập → tab con trong chi tiết HĐ nhập
const IN_TAB = {
  in_progress:  'progress',
  in_payable:   'payment',
  in_delivery:  'delivery',
  in_customs:   'customs',
  in_guarantee: 'guarantee',
  in_warranty:  'warranty',
}

// Đường dẫn nhảy thẳng tới đúng trang chứa mốc việc được nhấn.
export function targetUrl(it) {
  // Việc module KT Cơ điện không gắn hợp đồng → về bảng công việc của phòng.
  if (it.source_type === 'dept_work_task') return '/cong-viec/kt-co-dien/board'
  // Đầu việc checklist đấu thầu → trang riêng cho người được giao (không vào module Đấu thầu).
  if (it.source_type === 'tender_checklist') return `/viec-dau-thau/${it.source_id}`
  if (!it.contract_id) return null
  if (it.side === 'Nhập' && it.contract_in_id) {
    const inTab = IN_TAB[it.source_type] || 'info'
    return `/qlda/${it.contract_id}?tab=purchase-contract-info&inId=${it.contract_in_id}&inTab=${inTab}`
  }
  const menu = SELL_MENU[it.source_type]
  return menu ? `/qlda/${it.contract_id}?tab=${menu}` : `/qlda/${it.contract_id}`
}

export function dueInfo(due) {
  if (!due) return { cls: 'due-normal', label: '—', days: null }
  const days = daysBetween(due, todayISO()) // còn lại
  if (days < 0)  return { cls: 'due-overdue', label: `Quá hạn ${Math.abs(days)} ngày`, days }
  if (days === 0) return { cls: 'due-overdue', label: 'Đến hạn hôm nay', days }
  if (days <= 7) return { cls: 'due-soon', label: `Còn ${days} ngày`, days }
  return { cls: 'due-normal', label: `Còn ${days} ngày`, days }
}
