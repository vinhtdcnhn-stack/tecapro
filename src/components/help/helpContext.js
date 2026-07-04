// Định vị ngữ cảnh cho panel trợ giúp: đang đứng ở trang/tab nào thì bấm ❓ mở
// thẳng tới trang hướng dẫn tương ứng. Nguồn ngữ cảnh:
//   - pathname + query (?tab=, ?inTab= của chi tiết HĐ; /:section của các trang khác)
//   - bảng điều khiển trang chủ đang chọn (key từ useHomeDashboards, Header truyền vào)
//   - tab Kế toán đang xem (localStorage 'accounting_tab' — AccountingDashboard tự lưu)
// Khi thêm trang/tab mới có hướng dẫn riêng, bổ sung map tương ứng ở đây.

const CONTRACT_TAB_TO_PAGE = {
  'contract-info': 'co-info',
  'contract-documents': 'co-docs',
  'contract-pricing': 'co-boq',
  'contract-supply': 'co-supply',
  'contract-progress': 'co-progress',
  'contract-debt': 'co-debt',
  'contract-invoice': 'co-invoice',
  'contract-warranty': 'co-warranty',
  'contract-guarantee': 'co-guarantee',
  'contract-tasks': 'co-tasks',
}

const CONTRACT_IN_TAB_TO_PAGE = {
  info: 'ci-info',
  documents: 'ci-docs',
  pricing: 'ci-pricing',
  delivery: 'ci-delivery',
  serials: 'ci-serials',
  payment: 'ci-payment',
  progress: 'ci-progress',
  warranty: 'ci-warranty',
  guarantee: 'ci-guarantee',
  customs: 'ci-customs',
  logistics: 'ci-logistics',
}

const DEPT_SECTION_TO_PAGE = { board: 'dw-board', logs: 'dw-logs', capacity: 'dw-capacity' }

const APPROVAL_SECTION_TO_PAGE = {
  my: 'ap-my', inbox: 'ap-inbox', upcoming: 'ap-other',
  following: 'ap-other', all: 'ap-admin', forms: 'ap-admin',
}

const ADMIN_SECTION_TO_PAGE = {
  users: 'ad-users', departments: 'ad-catalog', positions: 'ad-catalog',
  customers: 'ad-catalog', suppliers: 'ad-catalog', 'bb-types': 'ad-catalog',
  'telegram-log': 'ad-feedback-tg', feedback: 'ad-feedback-tg', backup: 'ad-backup',
  'phan-quyen': 'ad-permissions', 'nhat-ky-thay-doi': 'ad-audit',
  'chan-doan-hieu-nang': 'ad-diagnostics',
}

const HOME_DASH_TO_PAGE = {
  pm: 'home-pm', director: 'home-director', tender: 'home-tender-dash',
  dept: 'home-dept', assignee: 'home-assignee', unread: 'home-unread',
}

const ACC_TAB_TO_PAGE = {
  overview: 'acc-overview', invoice: 'acc-invoice', overdue: 'acc-overdue',
  receivables: 'acc-receivables', payables: 'acc-payables', progress: 'acc-progress',
  debt: 'acc-debt-summary', warranty: 'acc-warranty',
}

// Trả { groupId, pageId } của trang hướng dẫn khớp vị trí hiện tại, hoặc null (mở bình thường).
export function resolveHelpTarget(pathname, search, homeDashKey) {
  // Chi tiết HĐ bán: /qlda/:id?tab=...&inTab=... (tab được sync vào URL khi chuyển mục)
  if (/^\/qlda\/\d+/.test(pathname)) {
    const qs = new URLSearchParams(search)
    const tab = qs.get('tab') || 'contract-info'
    if (tab === 'purchase-contract-info') {
      return { groupId: 'contract-in', pageId: CONTRACT_IN_TAB_TO_PAGE[qs.get('inTab')] || 'ci-overview' }
    }
    return { groupId: 'contracts', pageId: CONTRACT_TAB_TO_PAGE[tab] || 'co-detail-nav' }
  }
  if (pathname.startsWith('/qlda')) return { groupId: 'contracts', pageId: 'co-list' }

  const dept = pathname.match(/^\/cong-viec\/kt-co-dien(?:\/([a-z-]+))?/)
  if (dept) return { groupId: 'deptwork', pageId: DEPT_SECTION_TO_PAGE[dept[1]] || 'dw-board' }

  // Chi tiết gói thầu: tab đang mở không nằm trong URL → mở trang "Thông tin chung".
  if (pathname.startsWith('/cong-viec/dau-thau/goi/')) return { groupId: 'tender', pageId: 'td-info' }
  if (pathname.startsWith('/cong-viec/dau-thau')) return { groupId: 'tender', pageId: 'td-list' }

  const appr = pathname.match(/^\/de-xuat(?:\/([a-z]+))?/)
  if (appr) return { groupId: 'approvals', pageId: APPROVAL_SECTION_TO_PAGE[appr[1]] || 'ap-my' }

  if (pathname.startsWith('/tracuu')) return { groupId: 'warranty', pageId: 'wl-lookup' }

  const admin = pathname.match(/^\/quantri(?:\/([a-z-]+))?/)
  if (admin) return { groupId: 'admin', pageId: ADMIN_SECTION_TO_PAGE[admin[1]] || 'ad-users' }

  // Trang chủ: theo bảng điều khiển đang chọn; bảng Kế toán đọc thêm tab đang xem.
  if (pathname === '/' || pathname === '/giaoban') {
    if (homeDashKey === 'accounting') {
      let t = null
      try { t = localStorage.getItem('accounting_tab') } catch { /* ignore */ }
      return { groupId: 'accounting', pageId: ACC_TAB_TO_PAGE[t] || 'acc-overview' }
    }
    return { groupId: 'home', pageId: HOME_DASH_TO_PAGE[homeDashKey] || 'home-switch' }
  }

  return null
}
