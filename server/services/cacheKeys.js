import { pool } from '../db.js'
import { cacheDel, cacheVersion, bumpVersion, isCacheReady } from '../cache.js'
import { DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS } from '../middleware/deptWorkAccess.js'

// Trung tâm QUY ƯỚC KEY + LỚP INVALIDATION cho toàn bộ cache. Gom hết vào 1 file để
// invalidation-chính-xác dễ bảo trì (không rải chuỗi key khắp controller). Controller ĐỌC
// dùng các hàm dựng key; controller GHI gọi các hàm invalidate* SAU khi ghi DB thành công
// (fire-and-forget, không await chặn response — mô phỏng pattern bumpLive của eventBus).

// ----------------------------- Dựng key -----------------------------

// Danh mục global ít đổi: lookup:customers, lookup:suppliers, ...
export const lookupKey = (name) => `lookup:${name}`

// Chi tiết theo từng thực thể: c:{id}:{tab} (HĐ bán), ci:{id}:{tab} (HĐ nhập), t:{id}:{tab} (gói thầu)
export const contractKey = (id, tab) => `c:${id}:${tab}`
export const contractInKey = (id, tab) => `ci:${id}:${tab}`
export const tenderKey = (id, tab) => `t:${id}:${tab}`

// Danh sách HĐ bán: per-user (lọc theo thành viên) nên dùng version-namespace, bump khi
// có HĐ/thành viên đổi (ảnh hưởng danh sách của nhiều người).
export async function contractListKey(userOrAll) {
  const v = await cacheVersion('contract-list')
  return `clist:v${v}:${userOrAll}`
}

// "Việc của tôi" (gói thầu phụ trách): per-user theo phân công → version-namespace, bump
// khi có gói thầu tạo/sửa/đổi phân công/xóa.
export async function tenderMyKey(userId) {
  const v = await cacheVersion('tender-my')
  return `t-my:v${v}:${userId}`
}
export function invalidateTenderMy() {
  return bumpVersion('tender-my')
}

// Danh sách gói thầu TOÀN CỤC: chỉ là một lookup ('tender-list'). invalidateLookup đã tự bump
// version cho ETag nên đây chỉ là alias đặt tên rõ nghĩa; gọi ở mọi chỗ danh sách gói đổi.
export function invalidateTenderList() {
  return invalidateLookup('tender-list')
}

// Dashboard cá nhân (per-user)
export const pmDashKey = (userId) => `dash:pm:${userId}`
export const assignedTasksKey = (userId) => `dash:pm-tasks:${userId}`
export const deptDashKey = (userId) => `dash:dept:${userId}`

// Tra cứu serial (global, cross-contract). Chuẩn hóa hoa để khớp quy ước serial.
export const serialLookupKey = (serial) => `serial-lookup:${String(serial).trim().toUpperCase()}`

// Danh sách loại đơn user được phép tạo: phụ thuộc cấu hình admin (is_active + phòng ban),
// per-user nên không liệt kê được hết key để xóa → dùng version-namespace, bump khi cấu hình đổi.
export async function approvalFormOptsKey(userId) {
  const v = await cacheVersion('approval-form-opts')
  return `approval:form-opts:v${v}:${userId}`
}

// Báo cáo: nhúng version-namespace để vô hiệu cả nhóm bằng 1 lần INCR (xem cache.js).
// Mỗi nhóm report (debt/warranty/task/tender) có namespace riêng.
// params: object tham số tùy ý (asOf/basis/from/to/...) — nối theo khóa đã sắp xếp để mỗi
// biến thể là 1 key ổn định, không phụ thuộc thứ tự field.
export async function reportKey(group, name, params = {}) {
  const v = await cacheVersion(`report:${group}`)
  const suffix = Object.keys(params).sort()
    .map((k) => `${k}=${params[k] ?? ''}`).join('&')
  return `report:${group}:v${v}:${name}:${suffix}`
}

// ------------------------- ETag / 304 (xác thực nhẹ) -------------------------
// Conditional GET TỔNG QUÁT cho mọi endpoint đọc-only dùng version-namespace. `ns` = tên
// namespace version (vd 'contract-list', 'tender-my', 'report:debt'); `tag` = nhãn ngắn cho
// ETag dễ đọc. Trả TRUE nếu đã gửi 304 (caller PHẢI return ngay, không chạy loader). Ngược
// lại set ETag để response sắp tới cache được, rồi caller tiếp tục tính + res.json().
//
// ETag = version của namespace: mỗi URL có params cố định nên chỉ biến thiên theo version;
// bất kỳ ghi nào trong nhóm đều bump version → ETag đổi → client buộc tải lại (không bao giờ
// stale). Với endpoint PER-USER (vd /contracts lọc theo thành viên), version là toàn cục nên
// ETag GIỐNG NHAU giữa các user — vẫn an toàn vì: (1) validator chỉ trả lời "có đổi không",
// mỗi client giữ body riêng; (2) Cache-Control: private cấm proxy chung cache; (3) client
// xóa kho điều kiện khi đăng xuất (clearConditionalCache ở src/lib/api.js).
//
// Khi cache TẮT, version = 0 cố định nên ta KHÔNG set ETag/không 304 (tránh phục vụ dữ liệu
// cũ) — hành xử y như trước khi có lớp này.
export async function versionNotModified(req, res, ns, tag = ns) {
  if (!isCacheReady()) return false
  const v = await cacheVersion(ns)
  const etag = `W/"${tag}-${v}"`
  // no-cache = trình duyệt được phép LƯU nhưng phải revalidate trước khi dùng (đúng cái ta
  // cần: lần sau nó tự gửi If-None-Match). private = không cho proxy chung cache (dữ liệu
  // theo phiên/đăng nhập).
  res.set('Cache-Control', 'no-cache, private')
  res.set('ETag', etag)
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return true
  }
  return false
}

// Wrapper cho nhóm báo cáo: namespace 'report:<group>', nhãn 'r-<group>'.
export function reportNotModified(req, res, group) {
  return versionNotModified(req, res, `report:${group}`, `r-${group}`)
}

// Wrapper cho danh mục (lookup): namespace 'lookup:<name>', nhãn 'lk-<name>'. Version được
// invalidateLookup TỰ bump (xem dưới) nên mọi chỗ invalidate danh mục sẵn có đều đồng bộ ETag.
export const lookupNotModified = (req, res, name) =>
  versionNotModified(req, res, `lookup:${name}`, `lk-${name}`)

// ----------------------------- Invalidation -----------------------------

// Danh mục: xóa thẳng key body (key xác định) ĐỒNG THỜI bump version 'lookup:<name>' để
// ETag/304 của GET danh mục đó đổi theo. Nhờ vậy mọi call-site invalidate danh mục sẵn có
// (không phải sửa) tự đồng bộ cả body cache lẫn validator. Xem lookupNotModified ở trên.
export function invalidateLookup(...names) {
  return Promise.all([
    cacheDel(names.map(lookupKey)),
    ...names.map((n) => bumpVersion(`lookup:${n}`)),
  ])
}

// Báo cáo: tăng version namespace → mọi key version cũ tự rụng theo TTL.
export function invalidateReports(group) {
  return bumpVersion(`report:${group}`)
}

// Cấu hình loại đơn đổi: xóa danh sách form (admin) + bump version form-options (mọi user).
export function invalidateApprovalForms() {
  return Promise.all([invalidateLookup('approval-forms'), bumpVersion('approval-form-opts')])
}

// Dashboard của 1 user cụ thể.
export function invalidateUserDashboards(userId) {
  if (userId == null) return
  return cacheDel(pmDashKey(userId), assignedTasksKey(userId), deptDashKey(userId))
}

// Danh sách HĐ bán đổi (tạo/sửa/xóa HĐ, đổi thành viên) → vô hiệu list của mọi user.
export function invalidateContractList() {
  return bumpVersion('contract-list')
}

// Mọi tab đã biết của 1 HĐ bán (dùng khi đổi thông tin gốc ảnh hưởng nhiều tab).
const CONTRACT_TABS = [
  'info', 'boq', 'invoices', 'invoice-summary', 'progress', 'receivable',
  'receivable-payments', 'guarantees', 'folders', 'files', 'deliveries',
  'equipment', 'warranty-cases', 'warranty-activities', 'contract-ins',
]
export function invalidateContract(id, ...tabs) {
  if (id == null || tabs.length === 0) return
  return cacheDel(tabs.map((t) => contractKey(id, t)))
}
export function invalidateContractAll(id) {
  if (id == null) return
  return cacheDel(CONTRACT_TABS.map((t) => contractKey(id, t)))
}

// Tab của 1 HĐ nhập.
export function invalidateContractIn(id, ...tabs) {
  if (id == null || tabs.length === 0) return
  return cacheDel(tabs.map((t) => contractInKey(id, t)))
}

// Tab của 1 gói thầu.
export function invalidateTender(id, ...tabs) {
  if (id == null || tabs.length === 0) return
  return cacheDel(tabs.map((t) => tenderKey(id, t)))
}

// Tra cứu serial: xóa cache cho từng serial liên quan (cũ + mới khi thay thế).
export function invalidateSerialLookup(...serials) {
  const keys = serials.flat().filter(Boolean).map(serialLookupKey)
  return cacheDel(keys)
}

// Ghi vào 1 HĐ → dashboard của MỌI thành viên HĐ đó cần làm mới (dashboard tổng hợp từ
// các bảng con của HĐ). Tra thành viên rồi xóa dashboard từng người. Nuốt lỗi: invalidation
// thất bại chỉ khiến cache hơi cũ tới khi hết TTL, không được làm hỏng request ghi.
export async function invalidateContractMembers(contractId) {
  if (contractId == null) return
  try {
    const { rows } = await pool.query(
      'SELECT user_id FROM contract_out_member WHERE contract_out_id = $1',
      [contractId],
    )
    await Promise.all(rows.map((r) => invalidateUserDashboards(r.user_id)))
  } catch {
    // bỏ qua — xem ghi chú ở trên
  }
}

// Ghi vào 1 HĐ NHẬP → dashboard thành viên HĐ BÁN cha (dashboard tổng hợp cả mốc/giao
// hàng/bảo lãnh của HĐ nhập). Map ci → contract_out_id → thành viên.
export async function invalidateContractInMembers(contractInId) {
  if (contractInId == null) return
  try {
    const { rows } = await pool.query(
      'SELECT contract_out_id FROM contract_in WHERE id = $1',
      [contractInId],
    )
    if (rows[0]?.contract_out_id != null) await invalidateContractMembers(rows[0].contract_out_id)
  } catch {
    // bỏ qua
  }
}

// Có nội dung dòng thời gian mới/xóa/đọc ở một CÔNG VIỆC HĐ → dòng việc đổi nền hổ phách
// (chưa đọc) trên các dashboard liệt kê việc đó. Làm mới dashboard của ĐÚNG nhóm người
// thấy việc này:
//   • mọi thành viên HĐ            → dashboard PM (liệt kê mọi việc của HĐ)
//   • người được giao việc          → dashboard "Việc của tôi"
//   • trưởng/phó (+admin) cùng phòng người được giao → dashboard "Công việc của phòng"
export async function invalidateDashboardsForContractTask(taskId) {
  if (taskId == null) return
  try {
    const { rows } = await pool.query(
      `WITH t AS (
         SELECT contract_out_id, assigned_to FROM contract_task WHERE id = $1
       )
       SELECT m.user_id AS id
         FROM contract_out_member m
         JOIN t ON t.contract_out_id = m.contract_out_id
       UNION
       SELECT assigned_to FROM t WHERE assigned_to IS NOT NULL
       UNION
       SELECT u.id
         FROM app_user u
         LEFT JOIN app_user_position ap ON ap.user_id = u.id
        WHERE u.department_id = (SELECT department_id FROM app_user
                                  WHERE id = (SELECT assigned_to FROM t))
          AND (ap.position_id = ANY($2::int[]) OR u.role = 1)`,
      [taskId, MANAGER_POSITION_IDS],
    )
    await Promise.all(rows.map((r) => invalidateUserDashboards(r.id)))
  } catch {
    // bỏ qua — cache hơi cũ tới khi hết TTL, không được làm hỏng request ghi
  }
}

// Tương tự cho VIỆC NỘI BỘ PHÒNG (KT Cơ điện). Người thấy việc:
//   • người đang được giao (assignment active) → dashboard "Việc của tôi"
//   • trưởng/phó (+admin) phòng KT Cơ điện      → dashboard "Công việc của phòng"
export async function invalidateDashboardsForDeptWorkTask(taskId) {
  if (taskId == null) return
  try {
    const { rows } = await pool.query(
      `SELECT a.assignee_id AS id
         FROM dept_work_assignment a
        WHERE a.task_id = $1 AND a.is_active
       UNION
       SELECT u.id
         FROM app_user u
         LEFT JOIN app_user_position ap ON ap.user_id = u.id
        WHERE u.department_id = $2
          AND (ap.position_id = ANY($3::int[]) OR u.role = 1)`,
      [taskId, DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS],
    )
    await Promise.all(rows.map((r) => invalidateUserDashboards(r.id)))
  } catch {
    // bỏ qua
  }
}
