import { useQuery } from '@tanstack/react-query'
import { apiGet } from './api'

// ── Khoá cache (query keys) ───────────────────────────────────────────────────
// Tập trung một chỗ để hook đọc và lớp prefetch ghi đều dùng CHUNG một khoá → không
// lệch key, không nạp trùng. Khoá có tham số là hàm trả về mảng.
export const qk = {
  // Dùng chung toàn app
  users: ['users'],
  customers: ['customers'],
  suppliers: ['suppliers'],
  departments: ['departments'],
  positions: ['positions'],
  managers: ['managers'],
  bbTypes: ['bb-types'],
  // Hợp đồng bán
  contracts: ['contracts'],
  contract: (id) => ['contract', String(id)],
  // Đấu thầu
  tenders: (mode = 'all') => ['tenders', mode],
  tenderMembers: ['tender', 'members'],
  tender: (id) => ['tender', String(id)],
  // Việc phòng (KT Cơ điện)
  deptTeams: ['dept-work', 'teams'],
  deptMembers: ['dept-work', 'members'],
  // Đề xuất / Phê duyệt
  approvalsMy: ['approvals', 'my'],
  approvalsInbox: ['approvals', 'inbox'],
  approvalsBrowse: (endpoint) => ['approvals', 'browse', endpoint],
  // Dashboard trang chủ (theo người xem)
  pmDashboard: (uid) => ['pm-dashboard', String(uid)],
  assignedTasks: (uid) => ['assigned-tasks', String(uid)],
  deptWorkDashboard: (uid) => ['dept-work-dashboard', String(uid)],
  unreadInbox: (uid) => ['unread-inbox', String(uid)],
  cashflowSummary: ['reports', 'cashflow-summary'],
}

// ── Fetcher dùng lại cho cả useQuery lẫn prefetch ─────────────────────────────
export const fetchers = {
  users: () => apiGet('/users'),
  customers: () => apiGet('/customers'),
  suppliers: () => apiGet('/suppliers'),
  departments: () => apiGet('/departments'),
  positions: () => apiGet('/positions'),
  managers: () => apiGet('/managers'),
  bbTypes: () => apiGet('/bb-types'),
  contracts: () => apiGet('/contracts'),
  contract: (id) => apiGet(`/contracts/${id}`),
  tenders: (mode = 'all') => apiGet(mode === 'my' ? '/tender/my' : '/tender'),
  tenderMembers: () => apiGet('/tender/members'),
  tender: (id) => apiGet(`/tender/${id}`),
  deptTeams: () => apiGet('/dept-work/teams'),
  deptMembers: () => apiGet('/dept-work/members'),
  approvalsMy: () => apiGet('/approvals/requests/my'),
  approvalsInbox: () => apiGet('/approvals/requests/inbox'),
  approvalsBrowse: (endpoint) => apiGet(endpoint),
  pmDashboard: (uid) => apiGet(`/pm/${uid}/dashboard`),
  assignedTasks: (uid) => apiGet(`/pm/${uid}/assigned-tasks`),
  deptWorkDashboard: (uid) => apiGet(`/dept/${uid}/work-dashboard`),
  unreadInbox: (uid) => apiGet(`/pm/${uid}/unread-inbox`),
  cashflowSummary: () => apiGet('/reports/cashflow-summary'),
}

const idEnabled = (id) => id != null && id !== '' && !Number.isNaN(Number(id))

// ── Hook tiện dụng ────────────────────────────────────────────────────────────
// `opts` cho phép truyền `enabled` (hoãn gọi tới khi đã đăng nhập / đúng quyền).
export const useUsers = (opts = {}) => useQuery({ queryKey: qk.users, queryFn: fetchers.users, ...opts })
export const useCustomers = (opts = {}) => useQuery({ queryKey: qk.customers, queryFn: fetchers.customers, ...opts })
export const useSuppliers = (opts = {}) => useQuery({ queryKey: qk.suppliers, queryFn: fetchers.suppliers, ...opts })
export const useDepartments = (opts = {}) => useQuery({ queryKey: qk.departments, queryFn: fetchers.departments, ...opts })
export const usePositions = (opts = {}) => useQuery({ queryKey: qk.positions, queryFn: fetchers.positions, ...opts })
export const useManagers = (opts = {}) => useQuery({ queryKey: qk.managers, queryFn: fetchers.managers, ...opts })
export const useBbTypes = (opts = {}) => useQuery({ queryKey: qk.bbTypes, queryFn: fetchers.bbTypes, ...opts })

export const useContracts = (opts = {}) => useQuery({ queryKey: qk.contracts, queryFn: fetchers.contracts, ...opts })
export function useContract(id, opts = {}) {
  return useQuery({ queryKey: qk.contract(id), queryFn: () => fetchers.contract(id), enabled: idEnabled(id), ...opts })
}

export function useTenders(mode = 'all', opts = {}) {
  return useQuery({ queryKey: qk.tenders(mode), queryFn: () => fetchers.tenders(mode), ...opts })
}
export const useTenderMembers = (opts = {}) => useQuery({ queryKey: qk.tenderMembers, queryFn: fetchers.tenderMembers, ...opts })
export function useTender(id, opts = {}) {
  return useQuery({ queryKey: qk.tender(id), queryFn: () => fetchers.tender(id), enabled: idEnabled(id), ...opts })
}

export const useDeptTeams = (opts = {}) => useQuery({ queryKey: qk.deptTeams, queryFn: fetchers.deptTeams, ...opts })
export const useDeptMembers = (opts = {}) => useQuery({ queryKey: qk.deptMembers, queryFn: fetchers.deptMembers, ...opts })

export const useApprovalsMy = (opts = {}) => useQuery({ queryKey: qk.approvalsMy, queryFn: fetchers.approvalsMy, ...opts })
export const useApprovalsInbox = (opts = {}) => useQuery({ queryKey: qk.approvalsInbox, queryFn: fetchers.approvalsInbox, ...opts })
export function useApprovalsBrowse(endpoint, opts = {}) {
  return useQuery({ queryKey: qk.approvalsBrowse(endpoint), queryFn: () => fetchers.approvalsBrowse(endpoint), enabled: !!endpoint, ...opts })
}

// staleTime 0: dashboard phải tươi — đọc xong quay lại là refetch ngay để dòng việc hết nền
// hổ phách (cache server per-user vẫn che DB nên refetch rẻ; render bản cũ trong RAM rồi làm
// mới ngầm, không chớp UI). Cùng quy ước với useUnreadInbox.
export function usePmDashboard(uid, opts = {}) {
  return useQuery({ queryKey: qk.pmDashboard(uid), queryFn: () => fetchers.pmDashboard(uid), enabled: idEnabled(uid), staleTime: 0, ...opts })
}
export function useAssignedTasks(uid, opts = {}) {
  return useQuery({ queryKey: qk.assignedTasks(uid), queryFn: () => fetchers.assignedTasks(uid), enabled: idEnabled(uid), staleTime: 0, ...opts })
}
export function useDeptWorkDashboard(uid, opts = {}) {
  return useQuery({ queryKey: qk.deptWorkDashboard(uid), queryFn: () => fetchers.deptWorkDashboard(uid), enabled: idEnabled(uid), staleTime: 0, ...opts })
}
export function useUnreadInbox(uid, opts = {}) {
  // staleTime 0: hộp thư phải tươi — đọc xong quay lại là refetch ngay (việc đã đọc rời danh sách),
  // không giữ bản cũ 60s như mặc định. Query nhẹ (2 truy vấn theo chỉ mục) nên chi phí không đáng kể.
  return useQuery({ queryKey: qk.unreadInbox(uid), queryFn: () => fetchers.unreadInbox(uid), enabled: idEnabled(uid), staleTime: 0, ...opts })
}
export const useCashflowSummary = (opts = {}) => useQuery({ queryKey: qk.cashflowSummary, queryFn: fetchers.cashflowSummary, ...opts })

// ── Danh sách endpoint "nóng" để nạp sẵn lúc trình duyệt rảnh (Lớp 2) ──────────
// Dữ liệu dùng chung gần như mọi trang đụng tới. Nạp trước → khi vào trang là có ngay.
export const HOT_QUERIES = [
  { queryKey: qk.contracts, queryFn: fetchers.contracts },
  { queryKey: qk.users, queryFn: fetchers.users },
  { queryKey: qk.customers, queryFn: fetchers.customers },
]
