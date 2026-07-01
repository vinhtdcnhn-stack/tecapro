# Nhật ký triển khai module Phân quyền

> Thiết kế & phân giai đoạn: [phan-quyen-plan.md](phan-quyen-plan.md).
> Mỗi lần code xong một phần, ghi 1 dòng vào đây (ngày — phase — việc đã làm — file
> đụng tới — trạng thái). Mục đích: làm từng phần, dừng/tiếp được mà không mất mạch.

## Trạng thái các giai đoạn

> **Cập nhật thiết kế 2026-06-30:** thêm yêu cầu của user — (1) panel **Ctrl+Shift+Q**
> bật ma trận quyền NGAY trên trang đang mở (admin), song song trang ma trận tập trung;
> (2) cấp granularity thứ 3 **section trong tab** (view-một-phần); (3) gán theo **cả
> position lẫn user** (bảng override). Catalog viết LẠI từ code thực tế (modules đã đổi
> nhiều) trong `server/auth/permissionCatalog.js` — không dùng danh sách 24-tab cũ.

| Phase | Nội dung | Trạng thái | Ngày |
|-------|----------|-----------|------|
| 0 | Khảo sát lại cây trang/tab/section + `permissionCatalog.js` (74 quyền: 21 global, 53 contract gồm 3 section) | ✅ xong | 2026-06-30 |
| 1 | CSDL: bảng `permission`, `position_permission`, `contract_role_permission`, `user_permission_override` + seed | ✅ xong (local) · ⏳ VPS | 2026-06-30 |
| 2 | Backend nền: `loadGlobalPermissions`, gắn vào `/auth/login` + `/auth/me`, `requirePermission` | ✅ xong | 2026-06-30 |
| 3 | Backend API: catalog + 3 ma trận (global/contract/user) GET/PUT + for-page | ✅ xong | 2026-06-30 |
| 4 | Frontend nền: `permissions` vào AuthContext + hook `usePermission` | ✅ xong | 2026-06-30 |
| 5 | Panel Ctrl+Shift+Q + trang ma trận tập trung (Hệ thống → Phân quyền) | ✅ xong | 2026-06-30 |
| 6A | Lớp A: lọc menu + gate trang + ghi Hệ thống/approvals theo perm | ✅ xong | 2026-06-30 |
| 6B | Lớp B: lọc tab/sub-tab .view + view-một-phần (section) + RBAC-hoá GHI HĐ bán | ✅ xong | 2026-06-30 |
| 7 | (Tùy chọn) mobile, tài liệu, quyền theo user | ⬜ Chưa làm | |

Ký hiệu: ⬜ chưa làm · 🟡 đang làm · ✅ xong · ⏸️ tạm dừng

## Nhật ký chi tiết

### 2026-06-17
- Khởi tạo tài liệu thiết kế `phan-quyen-plan.md` và nhật ký này.
- Chốt thiết kế **RBAC 2 lớp** (sau nhiều vòng trao đổi):
  - **Lớp A — toàn cục** neo vào `position`: quyền mức module/mục-Hệ-thống.
  - **Lớp B — theo hợp đồng** neo vào `member_role`: 24 tab × {view, manage}.
  - **Chặn cứng cả API GET** (non-member 403 khi đọc tab HĐ — thay đổi có chủ đích).
  - **Đích = một nguồn-sự-thật-duy-nhất**: XÓA mọi gate hard-code; "di trú" chỉ là
    bootstrap tạm thời (seed suy từ dữ liệu) để go-live chạy như cũ.
  - `requires` (DAG) cho cả 2 ma trận: auto-bật tiền đề + cảnh báo cascade; server tự
    mở rộng bao đóng khi lưu.
- `phan-quyen-plan.md` đã được viết lại theo bản 2 lớp này (là nguồn thiết kế chính thức).
- Chưa viết code. Bước kế tiếp: **Phase 1** (catalog + migration `048_permission_rbac.sql`).

### 2026-06-30
- [Phase 0] Khảo sát lại toàn bộ cây trang/tab/section từ code hiện tại (Header, ContractSidebar,
  contractInUtils, ContractWarrantyTab, QuantriPage/Sidebar, TenderPage/Detail, DeptWorkPage,
  ApprovalPage, contractAccess.js, contractMemberController.js).
- [Phase 0] Viết `server/auth/permissionCatalog.js` — nguồn-sự-thật-duy-nhất: 74 quyền
  (21 global lớp A, 53 contract lớp B gồm 3 section view-một-phần), 7 member_role, đồ thị
  `requires` + `expandWithRequires`/`dependentsOf`, và `PAGES`/`pageForPath` cho panel Ctrl+Shift+Q.
  Trạng thái: xong, đã chạy thử nạp module OK. Chờ user duyệt danh mục trước khi viết migration 048.

- [Phase 1] Migration `087_permission_rbac.sql` (KHÔNG phải 048 — migrations đã tới 086):
  DDL 4 bảng `permission` / `position_permission` / `user_permission_override` /
  `contract_role_permission` + index. Áp local OK. **VPS: CHƯA áp** (chạy:
  `psql ... -f server/migrations/087_permission_rbac.sql` rồi `node server/auth/seedPermissions.js`).
- [Phase 1] Seed bằng `server/auth/seedPermissions.js` (đọc thẳng catalog, idempotent): sync 74
  quyền + bootstrap (chỉ lần đầu khi grant rỗng). Local: 74 perms · 36 position_permission ·
  224 contract_role_permission (PM=53 toàn quyền, Technical=31, 5 vai trò khác=28). Gắn
  `initPermissions()` vào `server/index.js` (sync catalog mỗi lần khởi động).
- [Phase 1] Lưu ý parity: local KHÔNG có user dept 9 → `module.tender.view` seed 0 position
  (đúng thực tế). Đối chiếu lại trên VPS ở Phase 6 trước khi cắt gate cứng.

- [Phase 2] `server/auth/permissions.js`: `loadGlobalPermissions(userId, role)` (hợp
  position_permission + override allow/deny + expand requires; admin fail-open toàn quyền) và
  middleware `requirePermission(key)`. Gắn `permissions` vào response `/auth/login` (login) và
  `/auth/me` (getUserById) ở authController.js. Chưa đổi route nào → chưa đổi hành vi. Test:
  admin=21 perms, user dept7=5 module.*.view. Trạng thái: xong.

- [Phase 3] `permissionController.js` + `permissionRoutes.js` (mount `/api/permissions/*`,
  toàn bộ gắn `requirePermission('system.permissions.manage')`): `GET catalog`, `GET for-page`
  (panel Ctrl+Shift+Q theo pathname), `GET/PUT global-matrix` (position×perm), `GET/PUT
  contract-matrix` (member_role×perm), `GET/PUT user-overrides` (allow/deny global). PUT luôn
  `expandWithRequires` + lọc đúng scope trước khi ghi (transaction replace). Test mock req/res OK.

- [Phase 4] `permissions` (lớp A) đưa vào AuthContext (login + /auth/me) + hook
  `src/hooks/usePermission.js` (`has`/`hasAny`, admin fail-open). CHƯA lọc menu/nút (để Phase 6).
- [Phase 5] FE module Phân quyền `src/components/permissions/`: `permissionApi.js`,
  `permGraph.js` (auto-bật tiền đề + cascade client), `GlobalPermissionMatrix.jsx`,
  `ContractRolePermissionMatrix.jsx`, `UserOverrideEditor.jsx`, `PermissionPanel.jsx`
  (overlay Ctrl+Shift+Q, mount ở App Layout, chỉ system.permissions.manage), `PermissionAdminPanel.jsx`
  (trang tổng 3 tab) + `permissions.css`. Trang tổng vào Hệ thống → section `phan-quyen`
  (QuantriPage + Sidebar, admin-only). Build OK; test HTTP có phiên admin OK.
  CẢNH BÁO: Ctrl+Shift+Q trùng phím tắt thoát của Firefox — cân nhắc đổi nếu dùng Firefox.

- [Phase 6A] Lớp A đấu dây thật (giữ tương đương hành vi nhờ bootstrap):
  - FE: Header lọc menu theo `usePermission` (xoá `has_projects`/`department_id===7,9`);
    DeptWorkPage/TenderPage/TenderDetailPage gate vào module theo `module.{deptwork,tender}.view`;
    ApprovalPage mục admin theo `approvals.forms.manage` (bỏ canManageForms); QuantriPage gate
    trang `module.system.view` + section riêng (telegram/backup/phan-quyen) + nút thêm/sửa +
    bảng (userRole) theo `system.*.manage`.
  - BE: thay `requireAdmin` → `requirePermission(...)` cho users/departments/positions/customers/
    suppliers/bb-types/telegram-logs/backup/feedback + approvals forms&requests/all&admin-*.
  - Verify: admin POST check-email=200; user thường check-email & bb-types create=403. Build+boot OK.
  - CÒN SÓT (residual lớp A): nhãn "admin" hard-code trong vài component bảng (UserTable...) vẫn
    đọc userRole — đã ép `userRole={canManage?1:0}` nên đúng quyền; chưa rà toàn bộ role==1 cosmetic khác.
- [Phase 6B] CHƯA làm. Phát hiện XUNG ĐỘT THIẾT KẾ cần user quyết: ghi HĐ NHẬP hiện theo
  **creator-ownership** (contract_in.created_by, xem [[project_contract_in_creator_ownership]]),
  KHÔNG theo member_role. RBAC lớp B neo member_role nên nếu RBAC-hoá ghi HĐ nhập sẽ ĐỔI mô hình
  (mất creator-ownership). Phương án (a) giữ creator-ownership cho ghi HĐ nhập, RBAC chỉ lo .view
  hiển thị tab; (b) chuyển hẳn sang member_role. + Quyết chặn GET tab HĐ với non-member (403).

- [Phase 6B] Quyết định user (2026-06-30): (a) GIỮ creator-ownership cho ghi HĐ nhập —
  KHÔNG RBAC-hoá guard ghi; (b) KHÔNG chặn GET, chỉ ẩn tab ở FE.
- [Phase 6B] Backend: `loadContractPermissions(userId, role, contractId)` trong
  `server/auth/permissions.js` (hợp contract_role_permission theo member_role của user trong HĐ;
  admin toàn quyền) + endpoint `GET /api/contracts/:id/my-permissions`. Verify: admin=53,
  member(PM)=53, non-member=0.
- [Phase 6B] FE: `ContractPermContext` tổng quát hoá — thêm `perms` + `canView/canManage/canSection`
  (giữ canEdit/canEditSerial, tương thích ngược: thiếu perms → không lọc). `ContractManagementPage`
  fetch my-permissions → truyền xuống. Lọc tab theo `.view`: `ContractSidebar` (9 tab HĐ bán),
  `ContractWarrantyTab` (4 sub-tab), `ContractInDetail` (11 sub-tab HĐ nhập). Build+lint sạch (file mới).
- [Phase 6B] CÒN LẠI: (1) **ẩn cột "view một phần"** thực tế — `canSection` đã sẵn ở context nhưng
  CHƯA gắn vào BOQ (đơn giá)/Công nợ (số tiền)/giá mua HĐ nhập (bảng BOQ tách nhiều component,
  để sau cho an toàn); (2) tuỳ chọn RBAC-hoá guard GHI HĐ bán (hiện vẫn PM cứng — tương đương
  bootstrap nên đổi .manage trong ma trận HĐ bán CHƯA tác động backend ghi); (3) chặn GET nếu sau
  này muốn. Gate hard-code lớp A đã xoá; lớp B (PM/Technical/creator) GIỮ theo quyết định user.

- [Phase 6B+] "View một phần" (section) ĐÃ GẮN UI hoàn chỉnh cho cả 3 section qua cờ
  `showPrice`/`showAmounts` (che `•••`, giữ canh bảng — KHÔNG bỏ cột vì tfoot dùng colSpan):
  - `co.boq.unit_price`: ContractBOQTab (summary+tfoot) + BOQRow + BOQZoneRow + BOQGroupRow + BOQMobile.
  - `ci.pricing.unit_price`: ContractInBOQTab (summary+tfoot) + PurchaseBOQRow.
  - `co.receivable.amounts`: ContractReceivableTab (cards+banner) + ReceivableScheduleSection +
    LinkedPaymentsRow + ReceivableMobile (che cả ô nhập "Giá trị" vì EditGuard chỉ disable, vẫn lộ số).
  CSS `.boq-masked`/`.recv-masked`. Build+boot+lint sạch. Mặc định mọi role có section nên không đổi gì.
- [Phase 6B+] #2 RBAC-hoá GHI HĐ bán: KHÔNG làm (chốt giữ PM/creator). Lý do parity: swap máy móc
  pmVia→contractPermVia sẽ ĐỔI hành vi vì bootstrap chưa khớp 1-1 với guard hiện tại — vd serial
  BẢO HÀNH HĐ bán (warrantyRoutes /serials) hiện **PM-only** (`pmVia('serial')`) nhưng Technical
  được seed `co.warranty.serials.manage` (Technical thực ra chỉ làm serial phía HĐ NHẬP qua
  ownerOrTechVia). Cần rà từng route + sửa bootstrap cho khớp trước khi swap. Để lại làm có chủ đích.

- [Phase 6B #2] RBAC-hoá GHI HĐ bán (parity-exact, route-by-route):
  - Sửa bootstrap: GHI co.*.manage CHỈ cho PM (bỏ Technical khỏi manage — vì HĐ bán vốn PM-only
    qua pmVia; Technical/serial phía HĐ nhập do ownerOrTechVia lo). Re-seed local: PM=53(25 manage),
    các role khác=28(0 manage).
  - contractAccess.js: thêm factory `contractPermFromParam/Via/ViaBody(permKey, ...)` — cho qua nếu
    user có member_role trong HĐ được cấp permKey (admin bypass).
  - Swap guard HĐ bán: boqRoutes(co.boq.manage), contractRoutes PUT(co.info.manage),
    guaranteeRoutes(co.guarantee.manage), invoiceRoutes(co.invoice.manage),
    progressRoutes contract(co.progress.manage), receivableRoutes(co.receivable.manage),
    warrantyRoutes(equipment/serials/cases/activities.manage). GIỮ NGUYÊN: documentRoutes(docGuard
    đa nhánh), taskRoutes(assignee), mọi contract-in(creator), delivery-serials/replace(ownerOrTech).
  - FE: `EditGuard` thêm prop `perm` → `canManage(perm)` (mặc định = PM nên parity). Wire perm vào
    9 tab HĐ bán (BOQ/Progress/Receivable/Guarantee/Invoice/Warranty equipment/serials/cases + CaseDetail).
  - Verify backend parity: POST /contracts/1/boq/reorder → PM=400(qua guard) Technical=403 Presale=403;
    serials/import → PM qua, Technical=403 (đúng PM-only). Build+boot+lint sạch (lỗi formatCurrency có sẵn).
  - Nay đổi .manage trong ma trận HĐ bán (hoặc panel Ctrl+Shift+Q) tác động CẢ backend lẫn nút FE.

- [Phase 6B+] Kế thừa TRƯỞNG/PHÓ PHÒNG (yêu cầu user 2026-06-30): "user được cấp quyền gì thì
  trưởng/phó phòng của họ cũng có". Định nghĩa: user giữ chức **TP** (Trưởng ban) hoặc **PP**
  (Phó ban) + cùng `department_id`. Phạm vi: CHỈ Lớp A (toàn cục). Tính lúc-truy-vấn (KHÔNG
  migration, không lưu trùng): `loadGlobalPermissions` = quyền riêng ∪ HỢP quyền RIÊNG hiệu lực
  (allow−deny) của mọi thành viên cùng phòng (qua `headDeptIds` + `deptMembersEffectiveRaw` trong
  permissions.js). Tự phản ánh ở FE (menu/nút) lẫn backend (requirePermission) vì cùng dùng hàm này.
  Verify: cấp member dept7 override system.users.manage → TP(8)+PP(9) dept7 kế thừa, TP dept4 không.
  Ghi chú vàng trong trang Hệ thống → Phân quyền.

- [Phase 6B+] Rà soát & mở rộng "view một phần" TẤT CẢ tab có tiền (yêu cầu user). Thêm 7 section
  (catalog 81 perms, 10 section): co.info.amounts (trước/sau VAT Thông tin HĐ bán),
  co.invoice.amounts, co.guarantee.amounts, ci.info.amounts (giá trị HĐ nhập: form + danh sách +
  card + detail header), ci.payment.amounts, ci.guarantee.amounts, ci.customs.amounts. Mask CẢ
  desktop, dòng tổng/tfoot, ô nhập (EditGuard chỉ disable nên vẫn lộ số) VÀ mobile/card.
  Tab KHÔNG tiền (bỏ): Thông tin HĐ bán chỉ phần phi-tiền, Nhận hàng (số lượng), Logistics.
  FIX QUAN TRỌNG: ContractInTab bọc ContractPermProvider CON không truyền `perms` → canView/canSection
  của mọi tab HĐ nhập bị vô hiệu (luôn true). Đã expose `perms` từ context + ContractInTab truyền
  tiếp (giữ canEdit theo creator). Nhờ đó lọc tab .view HĐ nhập + che số tiền HĐ nhập MỚI thực sự chạy.
  Verify: Technical thu hồi ci.customs.amounts → resolver bỏ đúng key, giữ key khác. Build+lint sạch.
  CÒN: trang DANH SÁCH /qlda (ContractTable) hiển thị tiền nhưng ở MODULE-level (ngoài 1 HĐ, không
  dưới ContractPermProvider) → cần perm global riêng nếu muốn che; chưa làm, báo user.

### 2026-06-30 — Panel Ctrl+Shift+Q gọn theo tab + thêm ma trận vị trí cho trang HĐ
- [UX] Panel chi tiết HĐ trước dồn HẾT quyền HĐ (rối). Nay LỌC theo TAB đang mở:
  `ContractManagementPage` đồng bộ `activeMenu` → URL `?tab=` (replace); `PermissionPanel`
  đọc `?tab=` lúc render + map `MENU_PERM_PREFIX` (id tab → tiền tố key co.*/ci.*) lọc hàng,
  đổi tab là panel đổi theo (không refetch). Tab không nhận diện → hiện đủ (an toàn).
- [Position] Thêm ma trận theo VỊ TRÍ (Lớp A) ngay trong panel HĐ — KHÔNG đổi mô hình dữ liệu,
  chỉ gom GlobalPermissionMatrix sẵn có. PAGES.contract-detail thêm `relatedGlobalKeys`
  (`module.contracts.view`); `getForPage` trả thêm `globalPerms`; panel tải kèm global-matrix
  và render dưới ma trận vai trò HĐ ("Theo vị trí (toàn cục)"). Save dùng full grants nên
  không xoá nhầm quyền ngoài tầm nhìn. File: permissionCatalog.js, permissionController.js,
  PermissionPanel.jsx, ContractManagementPage.jsx, permissions.css. Trạng thái: xong, lint sạch.

<!-- Mẫu dòng log:
### YYYY-MM-DD
- [Phase N] <việc đã làm>. File: <đường dẫn>. Trạng thái: <xong/đang dở/chặn bởi ...>.
-->
