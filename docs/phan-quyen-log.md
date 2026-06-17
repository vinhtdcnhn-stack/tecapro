# Nhật ký triển khai module Phân quyền

> Thiết kế & phân giai đoạn: [phan-quyen-plan.md](phan-quyen-plan.md).
> Mỗi lần code xong một phần, ghi 1 dòng vào đây (ngày — phase — việc đã làm — file
> đụng tới — trạng thái). Mục đích: làm từng phần, dừng/tiếp được mà không mất mạch.

## Trạng thái các giai đoạn

| Phase | Nội dung | Trạng thái | Ngày |
|-------|----------|-----------|------|
| 1 | CSDL: bảng `permission`, `position_permission` + seed | ⬜ Chưa làm | |
| 2 | Backend nền: `loadPermissions`, gắn vào auth, `requirePermission` | ⬜ Chưa làm | |
| 3 | Backend API: catalog + matrix (GET/PUT) | ⬜ Chưa làm | |
| 4 | Frontend nền: AuthContext + `usePermission`, lọc menu | ⬜ Chưa làm | |
| 5 | UI tab Phân quyền (ma trận) | ⬜ Chưa làm | |
| 6 | Chuyển gate cũ sang `requirePermission`/`usePermission` | ⬜ Chưa làm | |
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

<!-- Mẫu dòng log:
### YYYY-MM-DD
- [Phase N] <việc đã làm>. File: <đường dẫn>. Trạng thái: <xong/đang dở/chặn bởi ...>.
-->
