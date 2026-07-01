// ─────────────────────────────────────────────────────────────────────────────
// permissionCatalog.js — NGUỒN-SỰ-THẬT-DUY-NHẤT của danh mục quyền (RBAC 2 lớp).
//
// Khảo sát lại từ code thực tế (2026-06-30) — KHÔNG dùng lại danh sách 24-tab cũ ở
// docs/phan-quyen-plan.md (modules đã đổi nhiều). Thiết kế & giai đoạn: docs/phan-quyen-plan.md.
//
// Ba cấp granularity:
//   • Lớp A (scope 'global') — neo vào `position`, ghi đè được theo user. Quyền vào
//     module/menu và các mục con của phần Hệ thống / Đề xuất / Đấu thầu / Công việc.
//   • Lớp B (scope 'contract') — neo vào `contract_out_member.member_role`. Mỗi tab có
//     {view, manage}. View = thấy tab; Manage = ghi/sửa/xoá trong tab.
//   • Section (scope 'contract', kind 'section') — VIEW-MỘT-PHẦN: thấy tab nhưng một
//     khối con bị ẩn nếu thiếu quyền section (vd ẩn đơn giá ở Bảng giá, ẩn số tiền ở
//     Công nợ). Section chỉ có .view, requires .view của tab cha.
//
// Mỗi quyền khai `requires` (DAG) — đồ thị phụ thuộc KHÔNG lưu DB, server tự mở rộng
// bao đóng khi ghi ma trận (xem expandWithRequires bên dưới). Bảng `permission` chỉ
// seed key/scope/label/group_label/sort_order suy từ file này.
// ─────────────────────────────────────────────────────────────────────────────

// Vai trò trong hợp đồng (khớp TEAM_ROLES ở contractMemberController.js + 'PM').
export const MEMBER_ROLES = [
  { role: 'PM',           label: 'PM (Quản lý dự án)' },
  { role: 'Sale',         label: 'Kinh doanh' },
  { role: 'Presale',      label: 'Presale' },
  { role: 'Technical',    label: 'Kỹ thuật' },
  { role: 'ImportExport', label: 'Xuất nhập khẩu' },
  { role: 'Accounting',   label: 'Kế toán' },
  { role: 'Follower',     label: 'Theo dõi' },
]

// ─────────────────────────────────────────────────────────────────────────────
// LỚP A — GLOBAL (neo position, override per-user)
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL = [
  // ── Vào module (menu gốc) — requires [] ───────────────────────────────────
  { key: 'module.contracts.view',        group: 'Vào module', label: 'Hợp đồng bán' },
  { key: 'module.deptwork.view',         group: 'Vào module', label: 'Công việc — Dự án & chuyển giao công nghệ' },
  { key: 'module.tender.view',           group: 'Vào module', label: 'Công việc — Kế hoạch đấu thầu' },
  { key: 'module.approvals.view',        group: 'Vào module', label: 'Đề xuất' },
  { key: 'module.warranty_lookup.view',  group: 'Vào module', label: 'Tra cứu bảo hành' },
  { key: 'module.system.view',           group: 'Vào module', label: 'Hệ thống' },

  // ── Bảng điều khiển trang chủ — requires [] (độc lập, không thuộc module nào).
  // Quyết định bảng nào hiện ở Trang chủ (useHomeDashboards). "Tiến độ dự án" còn có
  // fallback dữ liệu: ai là thành viên ≥1 HĐ vẫn thấy dù vị trí chưa được cấp. ──────
  { key: 'dashboard.pm.view',         group: 'Bảng điều khiển', label: 'Tiến độ dự án' },
  { key: 'dashboard.director.view',   group: 'Bảng điều khiển', label: 'Tổng quan hệ thống' },
  { key: 'dashboard.accounting.view', group: 'Bảng điều khiển', label: 'Kế toán' },
  { key: 'dashboard.tender.view',     group: 'Bảng điều khiển', label: 'Kế hoạch đấu thầu' },
  { key: 'dashboard.dept.view',       group: 'Bảng điều khiển', label: 'Việc của phòng' },
  { key: 'dashboard.assignee.view',   group: 'Bảng điều khiển', label: 'Việc của tôi' },
  { key: 'dashboard.unread.view',     group: 'Bảng điều khiển', label: 'Chưa đọc' },

  // ── Phần Hệ thống — mỗi mục requires module.system.view ───────────────────
  { key: 'system.users.manage',       group: 'Hệ thống', label: 'Quản lý người dùng',   requires: ['module.system.view'] },
  { key: 'system.departments.manage', group: 'Hệ thống', label: 'Quản lý phòng ban',    requires: ['module.system.view'] },
  { key: 'system.positions.manage',   group: 'Hệ thống', label: 'Quản lý vị trí',       requires: ['module.system.view'] },
  { key: 'system.customers.manage',   group: 'Hệ thống', label: 'Quản lý khách hàng',   requires: ['module.system.view'] },
  { key: 'system.suppliers.manage',   group: 'Hệ thống', label: 'Quản lý nhà cung cấp', requires: ['module.system.view'] },
  { key: 'system.bbtypes.manage',     group: 'Hệ thống', label: 'Quản lý loại biên bản',requires: ['module.system.view'] },
  { key: 'system.feedback.manage',    group: 'Hệ thống', label: 'Xử lý góp ý cải thiện',requires: ['module.system.view'] },
  { key: 'system.telegram_log.view',  group: 'Hệ thống', label: 'Xem nhật ký Telegram', requires: ['module.system.view'], adminOnly: true },
  { key: 'system.audit_log.view',     group: 'Hệ thống', label: 'Xem nhật ký thay đổi',  requires: ['module.system.view'], adminOnly: true },
  { key: 'system.backup.manage',      group: 'Hệ thống', label: 'Sao lưu / Khôi phục',  requires: ['module.system.view'], adminOnly: true },
  { key: 'system.permissions.manage', group: 'Hệ thống', label: 'Phân quyền (cấu hình quyền)', requires: ['module.system.view'], adminOnly: true },

  // ── Đề xuất — requires module.approvals.view ──────────────────────────────
  { key: 'approvals.forms.manage', group: 'Đề xuất', label: 'Quản trị biểu mẫu & xem mọi đơn', requires: ['module.approvals.view'], adminOnly: true },

  // ── Đấu thầu — requires module.tender.view ────────────────────────────────
  { key: 'tender.template.manage', group: 'Đấu thầu', label: 'Quản lý mẫu checklist',  requires: ['module.tender.view'] },
  { key: 'tender.reports.view',    group: 'Đấu thầu', label: 'Xem báo cáo đấu thầu',   requires: ['module.tender.view'] },
  { key: 'tender.manage',          group: 'Đấu thầu', label: 'Quản trị gói thầu (Trưởng ban)', requires: ['module.tender.view'] },

  // ── Công việc phòng (KT Cơ điện) — requires module.deptwork.view ──────────
  { key: 'deptwork.manage', group: 'Công việc phòng', label: 'Quản lý công việc phòng (Trưởng/Phó ban)', requires: ['module.deptwork.view'] },
]

// ─────────────────────────────────────────────────────────────────────────────
// LỚP B — CONTRACT (neo member_role). Sinh .view + .manage từ định nghĩa tab.
// requiresView: tab cha mà .view của tab này phụ thuộc (vd warranty sub-tab, HĐ nhập).
// ─────────────────────────────────────────────────────────────────────────────

const CO_TABS = [
  { key: 'co.info',       group: 'HĐ bán', label: 'Thông tin hợp đồng' },
  { key: 'co.documents',  group: 'HĐ bán', label: 'Tài liệu hợp đồng' },
  { key: 'co.boq',        group: 'HĐ bán', label: 'Bảng giá' },
  { key: 'co.supply',     group: 'HĐ bán', label: 'Theo dõi nhập hàng' },
  { key: 'co.progress',   group: 'HĐ bán', label: 'Tiến độ theo biên bản' },
  { key: 'co.receivable', group: 'HĐ bán', label: 'Công nợ' },
  { key: 'co.invoice',    group: 'HĐ bán', label: 'Quản lý hóa đơn' },
  { key: 'co.warranty',   group: 'HĐ bán', label: 'Bảo hành' },
  { key: 'co.guarantee',  group: 'HĐ bán', label: 'Bảo lãnh' },
  { key: 'co.tasks',      group: 'HĐ bán', label: 'Công việc triển khai' },
  { key: 'co.contractin', group: 'HĐ bán', label: 'Hợp đồng nhập (mục)' },

  // Sub-tab Bảo hành — .view requires co.warranty.view
  { key: 'co.warranty.equipment',  group: 'Bảo hành', label: 'Thiết bị bàn giao',  requiresView: 'co.warranty.view' },
  { key: 'co.warranty.serials',    group: 'Bảo hành', label: 'Quản lý Serial',     requiresView: 'co.warranty.view' },
  { key: 'co.warranty.cases',      group: 'Bảo hành', label: 'Case bảo hành',      requiresView: 'co.warranty.view' },
  { key: 'co.warranty.activities', group: 'Bảo hành', label: 'Nhật ký xử lý',      requiresView: 'co.warranty.view' },
]

// HĐ nhập — mọi sub-tab .view requires co.contractin.view.
const CI_TABS = [
  { key: 'ci.info',      group: 'HĐ nhập', label: 'Thông tin', requiresView: 'co.contractin.view' },
  { key: 'ci.documents', group: 'HĐ nhập', label: 'Tài liệu', requiresView: 'co.contractin.view' },
  { key: 'ci.pricing',   group: 'HĐ nhập', label: 'Bảng giá mua', requiresView: 'co.contractin.view' },
  { key: 'ci.delivery',  group: 'HĐ nhập', label: 'Nhận hàng', requiresView: 'co.contractin.view' },
  { key: 'ci.serials',   group: 'HĐ nhập', label: 'Quản lý Serial', requiresView: 'co.contractin.view' },
  { key: 'ci.payment',   group: 'HĐ nhập', label: 'Thanh toán', requiresView: 'co.contractin.view' },
  { key: 'ci.progress',  group: 'HĐ nhập', label: 'Tiến độ theo BB', requiresView: 'co.contractin.view' },
  { key: 'ci.warranty',  group: 'HĐ nhập', label: 'Bảo hành NCC', requiresView: 'co.contractin.view' },
  { key: 'ci.guarantee', group: 'HĐ nhập', label: 'Bảo lãnh', requiresView: 'co.contractin.view' },
  { key: 'ci.customs',   group: 'HĐ nhập', label: 'Xuất nhập khẩu', requiresView: 'co.contractin.view' },
  { key: 'ci.logistics', group: 'HĐ nhập', label: 'Theo dõi logistics', requiresView: 'co.contractin.view' },
]

// Section trong tab — VIEW-MỘT-PHẦN. Chỉ .view, requires .view của tab cha.
// Có = thấy khối; bỏ = ẩn khối dù vẫn vào được tab.
const SECTIONS = [
  // HĐ bán
  { key: 'co.info.amounts',       group: 'HĐ bán', label: 'Xem giá trị HĐ trước/sau VAT (Thông tin)', requiresView: 'co.info.view' },
  { key: 'co.boq.unit_price',     group: 'HĐ bán', label: 'Xem đơn giá / thành tiền (Bảng giá)', requiresView: 'co.boq.view' },
  { key: 'co.receivable.amounts', group: 'HĐ bán', label: 'Xem số tiền công nợ (Công nợ)',       requiresView: 'co.receivable.view' },
  { key: 'co.invoice.amounts',    group: 'HĐ bán', label: 'Xem số tiền hóa đơn (Quản lý hóa đơn)', requiresView: 'co.invoice.view' },
  { key: 'co.guarantee.amounts',  group: 'HĐ bán', label: 'Xem số tiền bảo lãnh (Bảo lãnh)',      requiresView: 'co.guarantee.view' },
  // HĐ nhập
  { key: 'ci.info.amounts',       group: 'HĐ nhập', label: 'Xem giá trị HĐ nhập (Thông tin/Danh sách)', requiresView: 'co.contractin.view' },
  { key: 'ci.pricing.unit_price', group: 'HĐ nhập', label: 'Xem đơn giá mua (Bảng giá mua)',     requiresView: 'ci.pricing.view' },
  { key: 'ci.payment.amounts',    group: 'HĐ nhập', label: 'Xem số tiền thanh toán (Thanh toán)', requiresView: 'ci.payment.view' },
  { key: 'ci.guarantee.amounts',  group: 'HĐ nhập', label: 'Xem số tiền bảo lãnh (Bảo lãnh)',     requiresView: 'ci.guarantee.view' },
  { key: 'ci.customs.amounts',    group: 'HĐ nhập', label: 'Xem chi phí xuất nhập khẩu (XNK)',    requiresView: 'ci.customs.view' },
]

// Sinh CONTRACT_PERMISSIONS từ định nghĩa tab/section.
function buildContractPerms() {
  const out = []
  const pushTab = (t) => {
    const viewReq = t.requiresView ? [t.requiresView] : []
    out.push({ key: `${t.key}.view`,   scope: 'contract', kind: 'tab',    group: t.group, label: `${t.label} — Xem`,  requires: viewReq })
    out.push({ key: `${t.key}.manage`, scope: 'contract', kind: 'tab',    group: t.group, label: `${t.label} — Sửa`,  requires: [`${t.key}.view`] })
  }
  CO_TABS.forEach(pushTab)
  CI_TABS.forEach(pushTab)
  SECTIONS.forEach(s => out.push({
    key: s.key, scope: 'contract', kind: 'section', group: s.group,
    label: s.label, requires: [s.requiresView],
  }))
  return out
}

const GLOBAL_PERMISSIONS = GLOBAL.map(p => ({
  scope: 'global', kind: 'global', requires: [], adminOnly: false, ...p,
}))
const CONTRACT_PERMISSIONS = buildContractPerms()

export const ALL_PERMISSIONS = [...GLOBAL_PERMISSIONS, ...CONTRACT_PERMISSIONS]
  .map((p, i) => ({ adminOnly: false, ...p, sort_order: i }))

const BY_KEY = new Map(ALL_PERMISSIONS.map(p => [p.key, p]))
export const permByKey = (key) => BY_KEY.get(key)
export const isGlobalKey = (key) => permByKey(key)?.scope === 'global'
export const isContractKey = (key) => permByKey(key)?.scope === 'contract'

// Mở rộng bao đóng tiền đề: với tập key cho trước, thêm mọi `requires` (đệ quy).
// Dùng cả khi seed bootstrap lẫn khi server ghi ma trận (không tin UI).
export function expandWithRequires(keys) {
  const result = new Set()
  const visit = (k) => {
    if (result.has(k)) return
    const p = BY_KEY.get(k)
    if (!p) return
    result.add(k)
    for (const r of (p.requires || [])) visit(r)
  }
  for (const k of keys) visit(k)
  return [...result]
}

// Các key phụ thuộc TRỰC TIẾP vào `key` (cho cảnh báo cascade khi bỏ tick ở UI).
export function dependentsOf(key) {
  return ALL_PERMISSIONS.filter(p => (p.requires || []).includes(key)).map(p => p.key)
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES — bản đồ "trang hiện tại → các quyền liên quan" cho panel Ctrl+Shift+Q.
// `test(pathname)` khớp route; `scope` cho biết panel mở ma trận lớp nào; `permKeys`
// lọc đúng quyền của trang đó (rỗng nghĩa là lấy theo prefix group ở client).
// ─────────────────────────────────────────────────────────────────────────────

export const PAGES = [
  {
    id: 'home', label: 'Trang chủ (bảng điều khiển)', scope: 'global',
    test: (p) => p === '/' || p === '/giaoban',
    permKeys: GLOBAL.filter(p => p.key.startsWith('dashboard.')).map(p => p.key),
  },
  {
    id: 'contracts', label: 'Hợp đồng bán', scope: 'global',
    test: (p) => p === '/qlda',
    permKeys: ['module.contracts.view'],
  },
  {
    id: 'contract-detail', label: 'Chi tiết hợp đồng', scope: 'contract',
    test: (p) => /^\/qlda\/\d+/.test(p),
    permKeys: CONTRACT_PERMISSIONS.map(p => p.key),
    // Lớp A liên quan trang: quyền VÀO module HĐ bán — panel hiện thêm ma trận theo VỊ TRÍ.
    relatedGlobalKeys: ['module.contracts.view'],
  },
  {
    id: 'deptwork', label: 'Công việc phòng', scope: 'global',
    test: (p) => p.startsWith('/cong-viec/kt-co-dien'),
    permKeys: ['module.deptwork.view', 'deptwork.manage'],
  },
  {
    id: 'tender', label: 'Đấu thầu', scope: 'global',
    test: (p) => p.startsWith('/cong-viec/dau-thau') || p.startsWith('/viec-dau-thau'),
    permKeys: ['module.tender.view', 'tender.template.manage', 'tender.reports.view', 'tender.manage'],
  },
  {
    id: 'approvals', label: 'Đề xuất', scope: 'global',
    test: (p) => p.startsWith('/de-xuat'),
    permKeys: ['module.approvals.view', 'approvals.forms.manage'],
  },
  {
    id: 'warranty-lookup', label: 'Tra cứu bảo hành', scope: 'global',
    test: (p) => p.startsWith('/tracuu'),
    permKeys: ['module.warranty_lookup.view'],
  },
  {
    id: 'system', label: 'Hệ thống', scope: 'global',
    test: (p) => p.startsWith('/quantri'),
    permKeys: GLOBAL.filter(p => p.key === 'module.system.view' || p.key.startsWith('system.')).map(p => p.key),
  },
]

export function pageForPath(pathname) {
  return PAGES.find(pg => pg.test(pathname)) || null
}
