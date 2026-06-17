# Kế hoạch: Module Phân quyền (RBAC 2 lớp)

> **Cách tiếp tục ở session mới:** mở Claude Code tại repo này và nói đại ý
> *"Đọc docs/phan-quyen-plan.md và docs/phan-quyen-log.md, rồi làm tiếp module Phân
> quyền — bắt đầu Phase N."* File này là **nguồn thiết kế chính thức**; log tiến độ ở
> [phan-quyen-log.md](phan-quyen-log.md). Khởi tạo 2026-06-17, chưa viết code.

## Bối cảnh

Phần **Hệ thống** cần khu vực **Phân quyền** để admin tự cấu hình quyền cho mọi module,
thay cho logic **hard-code rải rác** (`role==1`, `position_code`, `department_id===7`,
`has_projects`, và "ghi=PM/Technical, đọc=mọi user" trong
[contractAccess.js](../server/middleware/contractAccess.js)).

Người dùng đã chốt (qua nhiều vòng):
1. **2 chiều phân quyền tách biệt — 2 tab riêng.**
2. **Chặn cứng cả API GET** (không chỉ ẩn UI).
3. **Đích = một nguồn-sự-thật-duy-nhất:** sau khi xong, hệ thống **chỉ** đọc quyền từ
   RBAC mới; mọi gate hard-code bị **XÓA**. Việc "di trú" chỉ là **bootstrap tạm thời**
   để ngày đầu chạy như cũ; về sau đổi quyền = chỉ sửa ma trận.

## Hai lớp quyền

### Lớp A — Toàn cục (neo vào `position`)
Quyền hiệu lực = HỢP quyền của mọi position user giữ (`app_user_position`). Coarse, mức
module/mục Hệ thống. Key + `requires`:
- `module.contracts.view` · `module.deptwork.view` · `module.approvals.view` ·
  `module.warranty_lookup.view` · `module.system.view` (đều `requires: []`)
- `approvals.forms.manage` (requires `module.approvals.view`)
- `system.users.manage` · `system.departments.manage` · `system.positions.manage` ·
  `system.customers.manage` · `system.suppliers.manage` · `system.bbtypes.manage` ·
  `system.permissions.manage` (mỗi cái requires `module.system.view`;
  `system.permissions.manage` mặc định **chỉ admin**)
- KT Cơ điện nội bộ (HEAD/DEPUTY qua `dept_work_member`) và *chọn biến thể dashboard*
  (PM/GD theo position) **giữ mô hình động hiện có**; lớp A chỉ gate **vào module**.

### Lớp B — Theo hợp đồng (neo vào `member_role`)
Vai trò: PM/Sale/Presale/Technical/ImportExport/Accounting/Follower (theo `TEAM_ROLES`
trong [contractMemberController.js](../server/controllers/contractMemberController.js)).
Mỗi **tab** có `.view` và `.manage`. Đầy đủ 24 tab:
- **HĐ bán (9):** `co.info` · `co.documents` · `co.boq` · `co.progress` · `co.receivable`
  · `co.warranty` · `co.guarantee` · `co.tasks` · `co.contractin`
- **Sub-tab Bảo hành (4):** `co.warranty.equipment` · `co.warranty.serials` ·
  `co.warranty.cases` · `co.warranty.activities` (`.view` requires `co.warranty.view`)
- **HĐ nhập (11):** `ci.info` · `ci.documents` · `ci.boq` · `ci.delivery` · `ci.serials`
  · `ci.payment` · `ci.progress` · `ci.warranty` · `ci.guarantee` · `ci.customs` ·
  `ci.logistics` (`.view` requires `co.contractin.view`)
- `.manage` của một tab requires `.view` của chính tab đó. Ví dụ user nêu khớp:
  `ci.delivery.view` requires `co.contractin.view` ("xem thông tin HĐ nhập").

**Kiểm tra hiệu lực 1 tab / 1 user / 1 HĐ:**
- VIEW (GET): admin **HOẶC** (thành viên HĐ **VÀ** hợp các `member_role` của user trong
  HĐ đó có `tab.view`).
- MANAGE (ghi): admin **HOẶC** (thành viên **VÀ** `member_role` có `tab.manage`).

## Quan hệ phụ thuộc (cho cả 2 ma trận)
Mỗi quyền khai `requires` (DAG) trong `permissionCatalog.js` — một nguồn sự thật.
- **Khi TICK** → tự bật bao đóng tiền đề còn thiếu + thông báo *"Đã tự bật «X» vì «Y»
  cần."* Ô bật-kèm có dấu hiệu trực quan.
- **Khi BỎ TICK** một tiền đề đang được quyền khác phụ thuộc → cảnh báo + hỏi, rồi
  **bỏ theo dây chuyền (cascade)** hoặc hủy.
- **Chốt chặn server (không tin UI):** khi `PUT matrix`, server **tự mở rộng bao đóng
  tiền đề** trước khi ghi.

## Lược đồ CSDL (migration `server/migrations/048_permission_rbac.sql`)

```sql
CREATE TABLE permission (              -- danh mục chung 2 lớp
  key varchar(120) PRIMARY KEY,
  scope varchar(16) NOT NULL,         -- 'global' | 'contract'
  label varchar(255) NOT NULL,
  group_label varchar(120) NOT NULL,
  sort_order integer DEFAULT 0
);
CREATE TABLE position_permission (     -- lớp A
  position_id integer NOT NULL REFERENCES "position"(id) ON DELETE CASCADE,
  perm_key varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  PRIMARY KEY (position_id, perm_key)
);
CREATE TABLE contract_role_permission (-- lớp B
  member_role varchar(40) NOT NULL,    -- PM/Sale/Presale/Technical/ImportExport/Accounting/Follower
  perm_key varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  PRIMARY KEY (member_role, perm_key)
);
```
Đồ thị `requires` **không** lưu DB — khai trong code, seed `permission` từ đó. Áp tay vào
**local + VPS** (theo CLAUDE.md; DB là PostgreSQL local, không Docker; không re-run
schema.sql trên DB sống).

## Nguồn-duy-nhất + Bootstrap di trú (tạm thời)

**Đích:** sau khi hoàn tất, **không còn điều kiện hard-code phân quyền nào** trong code
(trừ `role==1` = admin fail-open). Mọi gate thay bằng `usePermission` /
`requirePermission` / `requireContractPerm`.

**Bootstrap (chạy 1 lần):** seed RBAC **suy từ dữ liệu hiện tại** để go-live ≈ như cũ;
sau đó admin chỉnh bằng ma trận. Điều kiện vốn-theo-user được suy về position lúc seed:

| Gate hard-code (sẽ XÓA) | Nơi | Bootstrap seed |
|---|---|---|
| Menu "Hợp đồng bán": `admin OR has_projects` | Header.jsx:53 | `module.contracts.view` → position đang có ≥1 thành viên là member HĐ |
| Menu "Công việc KT": `admin OR department_id===7` | Header.jsx:55 | `module.deptwork.view` → position đang có ≥1 user dept 7 |
| Menu Đề xuất/Tra cứu/Hệ thống: mọi user | Header.jsx | 3 quyền `module.*.view` tương ứng → **mọi** position |
| Nút ghi mục Hệ thống: `role==1` | QuantriPage.jsx | `system.*.manage` không seed → admin-only |
| Form-builder Đề xuất: `requireAdmin` | approvalRoutes | `approvals.forms.manage` không seed → admin-only |
| Ghi tab HĐ: PM (+Technical serial) | contractAccess.js | `PM`.manage=mọi tab; `Technical`.manage=`co.warranty.serials`,`ci.delivery`,`ci.serials`; khác `.manage=false` |
| Đọc tab HĐ của thành viên | (mở) | mọi `member_role`.view = tất cả tab |

**Thay đổi có chủ đích:** non-member bị **403 khi đọc** tab HĐ (đúng lựa chọn chặn GET).
Tra cứu bảo hành chéo vẫn mở vì dùng `module.warranty_lookup.view` riêng. Cosmetic nhỏ
do suy-từ-position (vd user không dự án thấy menu HĐ rỗng) chấp nhận được.

**Mở:** chọn biến thể dashboard theo position là *điều hướng hiển thị*, không phải
access-control → mặc định giữ nguyên; gộp vào RBAC (`dashboard.*.view`) ở Phase 7 nếu muốn.

## Các giai đoạn (cập nhật [phan-quyen-log.md](phan-quyen-log.md) sau mỗi phase)

- **Phase 1 — Catalog + CSDL:** `server/auth/permissionCatalog.js` (GLOBAL + CONTRACT,
  kèm `requires`); migration `048_…` tạo 3 bảng + seed `permission` + seed
  position/contract-role **đúng bảng Bootstrap**. Áp local + VPS.
- **Phase 2 — Backend lớp A:** `server/auth/permissions.js` →
  `loadGlobalPermissions(userId,role)`; trả `permissions` trong `/auth/login` & `/auth/me`
  ([authController.js](../server/controllers/authController.js)); middleware
  `requirePermission(key)`. Chưa đổi route → không đổi hành vi.
- **Phase 3 — Backend lớp B + API:** mở rộng
  [contractAccess.js](../server/middleware/contractAccess.js): resolver "member_roles của
  user trong HĐ" + factory `requireContractPerm` (manage) & `requireContractView` (GET),
  tận dụng RESOLVERS sẵn. Controller + route Phân quyền:
  `GET /api/permissions/catalog`, `GET/PUT /api/permissions/global-matrix`,
  `GET/PUT /api/permissions/contract-matrix` (chỉ `system.permissions.manage`) —
  **server tự mở rộng bao đóng `requires` khi ghi**.
- **Phase 4 — Frontend nền:** `permissions` (lớp A) vào
  [AuthContext.jsx](../src/context/AuthContext.jsx) + hook `usePermission`; lọc menu
  [Header.jsx](../src/components/layout/Header.jsx), sidebar/nút
  [QuantriPage.jsx](../src/pages/QuantriPage.jsx),
  [Sidebar.jsx](../src/components/layout/Sidebar.jsx) (giữ fallback admin).
- **Phase 5 — UI Phân quyền (2 tab):** route `/quantri/phan-quyen`; 2 ma trận tách
  component (<500 dòng): `GlobalPermissionMatrix.jsx` (position × perm) và
  `ContractRolePermissionMatrix.jsx` (member_role × tab × {view,manage}). Cả hai có
  auto-bật tiền đề + cảnh báo cascade; cuộn ngang cho ma trận rộng.
- **Phase 6 — Cắt chuyển + XÓA gate cũ (lớn):** sau bước này **không còn gate hard-code**.
  - Lớp A: thay `requireAdmin`/điều kiện cứng (mục Hệ thống, approvals.forms) bằng
    `requirePermission`; **xóa** `has_projects`/`department_id===7`/`role==1` trong
    Header → `usePermission`.
  - Lớp B: gắn `requireContractView` vào **GET** ~20 router tab HĐ; **thay**
    `pmVia/pmOrTechVia` → `requireContractPerm`. Mô hình PM/Technical cứng → tra
    `contract_role_permission`.
  - FE: lọc tab theo `.view` trong
    [ContractSidebar.jsx](../src/components/contracts/ContractSidebar.jsx),
    `SUB_TABS` ([contractInUtils.js](../src/components/contracts/contractInUtils.js)),
    `SUBTABS` ([ContractWarrantyTab.jsx](../src/components/contracts/ContractWarrantyTab.jsx));
    tổng quát hóa [ContractPermContext.jsx](../src/context/ContractPermContext.jsx) từ
    `canEdit/canEditSerial` → bộ perm theo tab (server tính & trả khi mở HĐ ở
    [ContractManagementPage.jsx](../src/pages/ContractManagementPage.jsx));
    [EditGuard.jsx](../src/components/contracts/EditGuard.jsx) gate theo `.manage` tab.
- **Phase 7 (tùy chọn):** mobile cho ma trận; tài liệu; (nếu muốn) `dashboard.*.view`;
  quyền ghi-đè theo user.

## Tệp chính
- **Mới:** `server/auth/permissionCatalog.js`, `server/auth/permissions.js`,
  `server/migrations/048_permission_rbac.sql`, `server/controllers/permissionController.js`,
  `server/routes/permissionRoutes.js`, `src/context/GlobalPermContext.jsx`,
  `src/hooks/usePermission.js`, `src/components/permissions/GlobalPermissionMatrix.jsx`,
  `src/components/permissions/ContractRolePermissionMatrix.jsx`.
- **Sửa:** `server/middleware/{auth,contractAccess}.js`,
  `server/controllers/authController.js`, `server/routes/index.js`, ~20
  `server/routes/*Routes.js`, `src/context/{AuthContext,ContractPermContext}.jsx`,
  `src/pages/{ContractManagementPage,QuantriPage}.jsx`,
  `src/components/layout/{Header,Sidebar}.jsx`,
  `src/components/contracts/{ContractSidebar,EditGuard,ContractWarrantyTab}.jsx`,
  `src/components/contracts/contractInUtils.js`.

## Rủi ro
- **Chặn GET đổi hành vi:** non-member mất quyền đọc tab HĐ — seed lớp B + đối chiếu
  trước go-live Phase 6.
- **Tự khóa:** admin fail-open; `system.permissions.manage` mặc định admin-only.
- **Hiệu năng:** lớp B truy vấn membership+role mỗi request — đã có tiền lệ ở
  contractAccess.js; gộp 1 truy vấn khi mở HĐ cho FE.
- **Luật <500 dòng:** tách 2 ma trận; `QuantriPage.jsx` đã lớn, không nhồi thêm.

## Kiểm thử (end-to-end)
1. Áp migration local; `npm run dev`.
2. **Lớp A:** user thường → menu/mục Hệ thống ẩn đúng; API ghi mục Hệ thống thiếu
   `*.manage` → 403.
3. **Lớp B:** trong 1 HĐ — Sale chỉ thấy tab được `.view`; GET tab ẩn → 403; write thiếu
   `.manage` → 403; PM đủ; Technical sửa serial, không sửa tab khác; admin toàn quyền.
4. **Ma trận:** tick `ci.delivery.view` → tự bật `co.contractin.view` + thông báo; bỏ
   tick `co.contractin.view` → cảnh báo cascade `ci.*`; PUT bỏ tiền đề qua API thô →
   server tự thêm lại.
5. **Parity bootstrap:** mẫu mỗi position + mỗi member_role → quyền mới khớp hành vi cũ
   (trừ non-member bị chặn đọc + cosmetic).
6. **Nguồn-duy-nhất:** grep xác nhận đã xóa hết `has_projects`, `department_id === 7`,
   `role == 1` (trừ định nghĩa admin), mô hình PM/Technical cứng. Bỏ 1 quyền trong ma
   trận → hành vi đổi ngay, không đường vòng legacy.
