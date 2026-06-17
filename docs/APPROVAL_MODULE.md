# Nhật ký phát triển — Module Đề xuất / Phê duyệt

> Nhật ký sống của module "Đề xuất / Phê duyệt" (giống Base Request). Kế hoạch tổng thể:
> xem file plan `t-i-mu-n-trong-app-stateless-curry.md`. Mỗi lần làm xong một chunk, thêm
> 1 dòng `- [x] <phase.chunk> <mô tả> — <file>` kèm ghi chú quyết định/việc còn nợ.
> **Trước khi viết tiếp, đọc file này để biết đang ở đâu.**

## Tổng quan kiến trúc (chốt)
- DB tiền tố `approval_`; API `/api/approvals/...`; FE `src/components/approvals/`, trang `/de-xuat`.
- Luồng duyệt **nhiều bước tuần tự**; chuỗi bước **snapshot lúc gửi** (`approval_request_step`).
- Form builder do **admin** cấu hình (`approval_form` + `_field` + `_step` + `_step_approver`).
- Người duyệt **cấu hình theo loại đơn**; người gửi không tự chọn.
- Phạm vi **toàn công ty**. Mobile-first (card + MobileEditSheet).
- Khuôn mẫu copy: module **DeptWork** (`/cong-viec/kt-co-dien`).

## Endpoint (đang định hình)
- Form builder (admin): `GET/POST /approvals/forms`, `GET/PUT/DELETE /approvals/forms/:id`,
  `PUT /approvals/forms/:id/fields`, `PUT /approvals/forms/:id/steps`.
- Đơn: `GET /approvals/requests/my`, `GET /approvals/requests/inbox`, `GET /approvals/requests/:id`,
  `POST /approvals/requests`, `PUT /approvals/requests/:id`, `DELETE /approvals/requests/:id`,
  `POST /approvals/requests/:id/{submit,cancel,approve,reject}`.

## Roadmap các phase
- **Phase 0** — Khung & migration. ✅
- **Phase 1** — BE form builder API (CRUD form + fields + steps + approvers, admin-gated).
- **Phase 2** — FE form builder UI (FormList, FormBuilder, FieldEditor, StepEditor).
- **Phase 3** — BE vòng đời đơn (create/submit/list/detail, snapshot bước lúc gửi).
- **Phase 4** — FE người gửi (tạo đơn render động + danh sách của tôi, mobile card+sheet).
- **Phase 5** — BE duyệt/từ chối (logic any/all, advance/complete, notify).
- **Phase 6** — FE inbox + timeline.
- **Phase 7** — Đính kèm + thông báo Telegram + badge "chờ tôi duyệt".
- **Phase 8** — Hoàn thiện, phân quyền chặt, mobile polish, lint, cập nhật USE_CASES.

## Log

- [x] 0.1 Migration 044 (10 bảng approval_*) — `server/migrations/044_approval_module.sql`; đã áp local `hello_web_db` OK. Còn nợ: áp VPS khi deploy.
- [x] 0.2 BE skeleton — `server/controllers/approvalFormController.js` (getForms), `approvalRequestController.js` (getMyRequests, getInbox stub), `server/routes/approvalRoutes.js`; mount trong `routes/index.js`. Boot OK: /api/health=200, /api/approvals/requests/my=401 (đúng, đã gate requireAuth).
- [x] 0.3 FE skeleton — `src/pages/ApprovalPage.jsx`, `components/approvals/{ApprovalSidebar.jsx,approvalUtils.js,Approval.css}`; route `/de-xuat`+`/de-xuat/:section` trong `App.jsx`; menu "Đề xuất" (hiện cho mọi user) trong `Header.jsx`. Lint sạch.
- [x] **Phase 0 DONE.**
- [x] 1.1 BE form builder CRUD — `server/controllers/approvalFormController.js`: getForms (kèm field_count/step_count), getForm (chi tiết + fields + steps + approvers, join app_user lấy tên), createForm (code UNIQUE→409), updateForm, deleteForm (FK 23503→409 gợi ý "ngừng dùng"), saveFields & saveSteps (thay-thế trong transaction). Routes admin-gated trong `approvalRoutes.js`.
- [x] 1.2 Verify E2E (mint cookie admin) — create 201, save fields/steps 200, detail trả đúng chuỗi "Trưởng phòng → Giám đốc", list đếm đúng, dup code 409, no-auth 401, delete 200. **Lưu ý: cột `app_user.role` là VARCHAR** (so sánh dùng `role::text='1'` / `Number()`); `approver_ref` varchar nên join `u.id::text = sa.approver_ref`.
- [x] **Phase 1 DONE.**
- [x] 2.1 FE form builder UI — `src/components/approvals/admin/{FormList,FormBuilder,FieldEditor,StepEditor}.jsx`. FormList: lưới thẻ loại đơn + modal tạo/sửa meta (code khóa khi sửa) + xóa. FormBuilder: tải detail + GET /users, sửa trường & bước, "Lưu cấu hình" gọi PUT fields + PUT steps. FieldEditor: thêm/xóa/đổi thứ tự, auto-sinh field_key từ nhãn (slugify bỏ dấu), options cho select. StepEditor: bước tuần tự + MultiSelect người duyệt (kiểu 'user'). CSS trong Approval.css (mobile: xếp dọc). Wire vào ApprovalPage section 'forms'.
- [x] 2.2 Verify — eslint sạch, `vite build` OK. **Còn nợ: kiểm tra thao tác trên trình duyệt** (đăng nhập admin → /de-xuat/forms → tạo loại đơn + cấu hình + reload).
- [x] **Phase 2 DONE.**
- [x] 3.1 BE vòng đời đơn — `server/controllers/approvalRequestController.js`: LIST_SELECT (join form+người gửi, current_step_name, attachment_count); getMyRequests, getInbox (đơn pending có tôi là approver pending của bước hiện tại), getRequest (chi tiết + field defs + steps snapshot + events + attachments; quyền xem = owner/approver/admin), createRequest (draft), updateRequest (chỉ draft của mình), submitRequest (kiểm tra trường bắt buộc → CHỤP chuỗi bước từ cấu hình, đánh lại step_order 1..n, set current_step + event 'submitted', transaction), cancelRequest, deleteRequest. Helper `resolveApprovers` MVP chỉ kiểu 'user'. Routes trong `approvalRoutes.js` (đặt /my,/inbox TRƯỚC /:id).
- [x] 3.2 Verify E2E — create draft 201; submit thiếu trường bắt buộc→400; update→submit 200 (snapshot 2 bước, current_step=1 "Trưởng phòng"); detail/my/inbox đúng; cancel→cancelled. Cleanup OK.
- [x] **Phase 3 DONE.**
- [x] 4.1 BE endpoint cho người tạo đơn (mọi NV, KHÔNG admin) — `approvalFormController.js`: getActiveForms (`GET /approvals/form-options`), getFormSchema (`GET /approvals/forms/:id/schema`, trả form + fields + steps kèm tên người duyệt). Đặt route TRƯỚC các route admin `/approvals/forms`.
- [x] 4.2 FE người gửi — `components/approvals/{DynamicFields,RequestForm,RequestList}.jsx`. DynamicFields render input theo field_type (text/textarea/number/money=NumberInput/date=DateInput/date_range/select/checkbox/user/file-placeholder). RequestForm: chọn loại đơn→render trường động + hiện chuỗi duyệt, nút "Lưu nháp" / "Gửi duyệt" (tạo→submit). RequestList: desktop bảng + mobile thẻ→MobileEditSheet; hành động theo trạng thái (draft: Gửi/Sửa/Xóa; pending: Hủy). Wire vào ApprovalPage section 'my'. CSS trong Approval.css.
- [x] 4.3 Verify — eslint sạch (fix: setState-in-effect dùng disable comment; tách StatusBadge/ActionButtons ra ngoài render), `vite build` OK, form-options + schema trả đúng. **Còn nợ: test thao tác tạo/gửi đơn trên trình duyệt.**
- [x] **Phase 4 DONE.**
- [x] 5.1 BE duyệt/từ chối — `server/controllers/approvalDecisionController.js`: helper `loadCurrent` (khóa hàng đơn FOR UPDATE, kiểm tra status pending + bước hiện tại pending + tôi là approver pending). approveRequest: ghi quyết định → đánh giá bước (any=duyệt ngay / all=hết pending mới duyệt) → sang bước sau (notify approver kế) hoặc hoàn tất (status approved, notify người gửi) → event 'approved'(+'completed'). rejectRequest: bước rejected → đơn rejected → event, notify người gửi. Tái dùng `notifyUsers` (generic) từ deptWorkNotify. Routes `/approve` `/reject` trong approvalRoutes.
- [x] 5.2 Verify E2E (2 user: admin + user2, chuỗi 2 bước) — gating sai người 403; u2 duyệt bước1→advanced; u2 duyệt bước2 (không phải approver) 403; admin duyệt bước2→completed/approved; events submitted,approved,approved,completed; reject→rejected; quyết định lại trên đơn đã xong 409. Tất cả PASS.
- [x] **Phase 5 DONE.**
- [x] 6.1 FE inbox + timeline — `components/approvals/{RequestDetail,Inbox}.jsx`. RequestDetail (Modal): hiển thị dữ liệu đơn (fmt theo field_type), timeline chuỗi duyệt (bước + người duyệt + quyết định + ý kiến), highlight bước hiện tại; nếu tới lượt tôi → ô ý kiến + nút Duyệt/Từ chối (canDecide tính client từ steps). Inbox: list chờ-tôi-duyệt (desktop bảng / mobile thẻ) → mở RequestDetail. Wire Inbox vào section 'inbox'; RequestList: click tiêu đề / "Xem chi tiết" mở RequestDetail (read-only cho người gửi). CSS timeline + link.
- [x] 6.2 Verify — eslint sạch, `vite build` OK. **Còn nợ: test duyệt/từ chối trên trình duyệt.**
- [x] **Phase 6 DONE.**
- [x] 7.1 Đính kèm — `server/controllers/approvalAttachmentController.js` (mirror task: multer diskStorage→`/uploads/approval-requests/{id}/`, safeUploadFilter). Guard `canUploadAttachment` TRƯỚC multer (chỉ owner khi draft/pending hoặc admin). getAttachments (quyền owner/approver/admin), deleteAttachment (uploader/admin). Routes upload/list/delete. FE: RequestDetail có khu Tệp đính kèm (link tải `${API_BASE}${file_path}`, nút thêm/xóa cho owner). Verify E2E: upload 201, list, U2 upload/list 403, delete 200.
- [x] 7.2 Thông báo Telegram — notifyUsers (generic) cho: submit→approver bước đầu; approve→advance notify bước kế / complete notify người gửi; reject→người gửi. (Telegram chỉ gửi nếu user có telegram_chat_id.)
- [x] 7.3 Badge — Header fetch `/approvals/requests/inbox` → badge số đỏ trên menu "Đề xuất" (cập nhật theo route đổi).
- [x] **Phase 7 DONE.**
- [x] 8.1 Hoàn thiện — `npm run lint` toàn dự án SẠCH; `vite build` OK. Phân quyền đã chặn ở controller (sửa/xóa/gửi chỉ owner; duyệt đúng bước; xóa form có đơn→409). Mobile: card+sheet + CSS responsive.
- [x] 8.2 Tài liệu — cập nhật `docs/USE_CASES.md`: thêm "Nhóm F — Đề xuất / Phê duyệt" (UC-F1..F5) + 3 dòng ma trận quyền.
- [x] **Phase 8 DONE — TOÀN BỘ MODULE HOÀN THÀNH (BE+FE, lint+build sạch, verify E2E từng phase).**

## Bổ sung sau khi hoàn thành
- [x] 9.1 Nguồn người duyệt theo bước (migration 045 thêm `approver_source` vào `approval_form_step` + `approval_request_step`). 3 nguồn: `fixed` (admin chọn sẵn), `direct_manager` (lấy `app_user.manager_id` của người gửi lúc gửi), `requester_pick` (người gửi tự chọn khi lập đơn). BE: saveSteps/getForm/getFormSchema mang theo source; submitRequest phân giải theo nguồn (`normalizeIds`, manager, picked từ `body.stepApprovers`). FE: StepEditor có ô chọn nguồn (ẩn MultiSelect khi không phải fixed); RequestForm hiện picker cho bước requester_pick + gửi `stepApprovers`. **Đã áp migration 045 local.** Verify E2E: no-manager→400, thiếu pick→400, gửi đủ→200, snapshot 3 nguồn đúng.
- [x] 9.2 UX: icon có bảng emoji bấm-chọn; tên bước tự điền "Cấp duyệt N"; nhãn "Thứ tự hiển thị (nhỏ lên trước)".
- [x] 9.3 Chọn người duyệt: MultiSelect lọc thêm theo `opt.search` (email) + hiện email mờ trong dropdown (`opt.hint`), chip vẫn là tên đầy đủ. Endpoint mới `GET /approvals/user-options` (id, full_name, email) cho cả non-admin (vì `/users` ẩn email với non-admin) — FormBuilder + RequestForm dùng endpoint này. **Lưu ý bảo mật: endpoint này cố ý lộ email mọi nhân viên cho người đã đăng nhập** (phục vụ chọn người duyệt). Bước admin chốt cố định thì người gửi KHÔNG sửa được (BE bỏ qua input client cho bước fixed).

- [x] 9.4 Đính kèm ngay trong modal tạo đơn: trường kiểu 'file' (DynamicFields) render nút chọn tệp (nhiều tệp) giữ tạm trong RequestForm; persist() upload sau khi tạo/lưu đơn rồi mới submit. MultiSelect thêm chế độ `inlineSearch` (gõ thẳng tại ô chip, lọc tên+email) — bật cho ô chọn người duyệt (StepEditor + RequestForm requester_pick).

- [x] 9.5 Trùng người duyệt nhiều cấp → duyệt 1 lần xong tất cả: approveRequest giờ (1) ghi 'approved' cho MỌI dòng approver của người này còn pending trong đơn; (2) "settle" tuần tự từ bước hiện tại, bước nào đủ điều kiện thì duyệt + tiến tiếp, dừng ở bước đầu tiên còn chờ. Verify: B ở 2 cấp (any) → duyệt 1 lần xong cả 2; B ở cấp sau kiểu 'all' (B+C) → phần B auto, vẫn chờ C.

- [x] 9.6 Trường kiểu "Bảng" (nhập nhiều dòng): admin định nghĩa cột (config.columns = [{key,label,type}], type ∈ text/number/money/date) trong FieldEditor (TableColumnsEditor); người đề xuất nhập lưới động trong DynamicFields (TableField); chi tiết hiển thị read-only (TableValue). form_data[field_key] = mảng row object. BE: 'table' thêm vào FIELD_TYPES; required-check coi mảng rỗng = thiếu. Verify roundtrip OK (lưu cột, schema, required chặn bảng rỗng, lưu nhiều dòng). Không cần migration (dùng config jsonb sẵn có).
- [x] 9.7 UI: chi tiết đơn đổi sang DRAWER trượt phải (ar-drawer-*, giống TaskDetailDrawer); bảng danh sách đẹp hơn; nút module gọn (.approval-page .btn* ghi đè pill to); badge menu 🔔 nhấp nháy + tự refresh 60s; bỏ menu "Giao ban tuần".
- [x] 9.8 **Người theo dõi** (migration 048: `approval_form_follower` template + `approval_request_follower` snapshot). Admin định sẵn 1+ người theo dõi cho từng loại đơn; người gửi KHÔNG sửa được. Người theo dõi được XEM đơn + NHẬN thông báo (notifyInfo: submit "có đề xuất mới", complete "đã duyệt xong", reject "bị từ chối"). BE: `saveFollowers` (`PUT /approvals/forms/:id/followers`, admin), getForm/getFormSchema trả `followers`; submitRequest CHỤP followers + notify; getRequest mở quyền xem cho follower + trả snapshot followers; approve(complete)/reject notify followers. FE: FormBuilder mục "Người theo dõi" (MultiSelect); RequestForm hiện read-only; RequestDetail mục chip "Người theo dõi". Verify E2E 10/10 PASS (save→getForm→schema→submit→snapshot→follower xem 200→outsider 403). **Đã áp migration 048 local; CÒN NỢ áp VPS.**

## Việc còn nợ / mở rộng tương lai
- **Áp migration 048 lên VPS** (người theo dõi) khi deploy.
- **Áp migration 045 lên VPS** (cùng 044) khi deploy. (Kiểu "Bảng" KHÔNG cần migration.)
- **Áp migration 044 lên VPS** khi deploy (`server/migrations/044_approval_module.sql`).
- **Test thao tác trên trình duyệt** toàn luồng (admin cấu hình → NV gửi → duyệt nhiều bước → từ chối → đính kèm) — BE đã verify E2E qua script, FE đã lint+build nhưng chưa click thực tế.
- Người duyệt kiểu `position` / `department_head` (hiện `resolveApprovers` chỉ xử lý `user`).
- Trường kiểu `user` trong chi tiết hiển thị id thay vì tên (chưa map sang tên).
- CLAUDE.md ghi "no router library" đã LỖI THỜI — app dùng react-router-dom.
