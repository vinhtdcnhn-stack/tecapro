# Tài liệu API — Hệ thống Quản lý Hợp đồng & Dự án

Tài liệu mô tả REST API của backend (Express). Mọi endpoint nghiệp vụ đều có tiền tố `/api`.

- **Base URL (dev):** `http://localhost:5174/api`
- **Định dạng:** JSON (`Content-Type: application/json`), trừ upload file dùng `multipart/form-data`
- **Bảng mã:** UTF-8

---

## 1. Xác thực & phiên đăng nhập

Đăng nhập bằng email + mật khẩu. Khi thành công, server đặt **cookie phiên `httpOnly`**
(tên `tecapro_auth`) chứa token đã ký HMAC. Trình duyệt tự gửi cookie này ở mọi request
kế tiếp — client **không** tự gắn token vào header.

- Mọi request phải gửi kèm cookie phiên (`credentials: 'include'` khi dùng `fetch`).
- Token sống 7 ngày. Đổi mật khẩu sẽ vô hiệu hóa mọi phiên cũ.
- Danh tính người dùng luôn lấy từ phiên ở phía server — không nhận `userId` từ client.

### Mức quyền (dùng trong bảng endpoint)

| Ký hiệu | Ý nghĩa |
|--------|---------|
| 🌐 | Công khai, không cần đăng nhập |
| 🔒 | Cần đăng nhập (bất kỳ user nào) |
| 👤 | Chính chủ hoặc admin (`requireSelfOrAdmin`) |
| 👑 | Chỉ admin (`role = 1`) |
| 🏗️ | Chỉ PM của hợp đồng liên quan, hoặc admin |

---

## 2. Quy ước chung

### Mã trạng thái

| Mã | Ý nghĩa |
|----|---------|
| `200` | Thành công |
| `400` | Dữ liệu gửi lên không hợp lệ |
| `401` | Chưa đăng nhập / sai thông tin đăng nhập |
| `403` | Không đủ quyền |
| `404` | Không tìm thấy tài nguyên |
| `409` | Xung đột (vd trùng mã, trùng serial) |
| `413` | Payload/tệp quá lớn |
| `429` | Quá nhiều lần đăng nhập sai (rate-limit) |
| `500` | Lỗi máy chủ |

### Định dạng lỗi

Mọi lỗi trả về JSON dạng:

```json
{ "error": "Mô tả lỗi" }
```

Ở môi trường production, lỗi 500 luôn trả thông điệp chung `"Đã xảy ra lỗi máy chủ."`
để không lộ chi tiết nội bộ.

### Giới hạn

- Body JSON: tối đa **100KB** (riêng 4 endpoint import nhận mảng lớn được nới **2MB**).
- Upload file đính kèm: tối đa **50MB/tệp**; import Excel: **5–10MB/tệp**.
- Đăng nhập sai: tối đa **10 lần / 15 phút / IP**.

---

## 3. Health-check

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/health` | 🌐 | Kiểm tra server + kết nối DB. Trả `{ "ok": true, "db": true }` (kết quả DB cache 5 giây). |

---

## 4. Xác thực & Người dùng

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| POST | `/api/auth/login` | 🌐 | Đăng nhập. Body `{ email, password }`. Đặt cookie phiên, trả hồ sơ người dùng. |
| POST | `/api/auth/logout` | 🌐 | Đăng xuất. Xóa cookie + thu hồi token. |
| GET | `/api/auth/me` | 🔒 | Hồ sơ người dùng đang đăng nhập (lấy từ phiên). |
| GET | `/api/users` | 🔒 | Danh sách người dùng (non-admin bị ẩn email/SĐT/mã NV...). |
| GET | `/api/users/:id` | 👤 | Chi tiết một người dùng. |
| GET | `/api/me/:id` | 👤 | Alias của `/users/:id`. |
| POST | `/api/users` | 👑 | Tạo người dùng mới. |
| PUT | `/api/users/:id` | 👑 | Cập nhật người dùng (gồm vai trò). |
| PUT | `/api/users/:id/change-password` | 👤 | Đổi mật khẩu. Body `{ current_password, new_password }` (admin reset không cần mật khẩu cũ). |
| POST | `/api/users/check-email` | 👑 | Kiểm tra email đã tồn tại chưa. |
| POST | `/api/users/check-username` | 👑 | Kiểm tra username đã tồn tại chưa. |
| POST | `/api/users/check-employee-code` | 👑 | Kiểm tra mã nhân viên đã tồn tại chưa. |

### Ví dụ — Đăng nhập

**Request**
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "mat-khau" }
```

**Response 200** (kèm `Set-Cookie: tecapro_auth=...; HttpOnly`)
```json
{
  "id": 12,
  "email": "user@example.com",
  "full_name": "Nguyễn Văn A",
  "role": 1,
  "department_id": 3,
  "department_code": "KT",
  "department_name": "Kế toán",
  "positions": [{ "id": 5, "code": "PM", "name": "Quản lý dự án" }],
  "position_code": "PM",
  "position_name": "Quản lý dự án"
}
```

Mật khẩu mới (create/update/change-password) phải **tối thiểu 8 ký tự**.

---

## 5. Danh mục dùng chung

> Ghi (tạo/sửa/xóa) danh mục dùng chung chỉ dành cho admin; mọi user đăng nhập đều xem được.

### Phòng ban / Chức vụ / Quản lý

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/departments` | 🔒 | Danh sách phòng ban. |
| POST | `/api/departments` | 👑 | Tạo phòng ban. Body `{ code, name }`. |
| PUT | `/api/departments/:id` | 👑 | Cập nhật phòng ban. |
| GET | `/api/positions` | 🔒 | Danh sách chức vụ/vị trí. |
| POST | `/api/positions` | 👑 | Tạo vị trí. Body `{ code, name }`. |
| PUT | `/api/positions/:id` | 👑 | Cập nhật vị trí. |
| GET | `/api/managers` | 🔒 | Danh sách người có thể làm quản lý. |

### Khách hàng

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/customers` | 🔒 | Danh sách khách hàng. |
| GET | `/api/customers/:id` | 🔒 | Chi tiết khách hàng. |
| POST | `/api/customers` | 👑 | Tạo khách hàng. |
| PUT | `/api/customers/:id` | 👑 | Cập nhật khách hàng. |
| POST | `/api/customers/check-code` | 👑 | Kiểm tra mã khách hàng trùng. |

### Nhà cung cấp

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/suppliers` | 🔒 | Danh sách nhà cung cấp. |
| GET | `/api/suppliers/:id` | 🔒 | Chi tiết nhà cung cấp. |
| POST | `/api/suppliers` | 👑 | Tạo nhà cung cấp. |
| PUT | `/api/suppliers/:id` | 👑 | Cập nhật nhà cung cấp. |
| POST | `/api/suppliers/check-code` | 👑 | Kiểm tra mã NCC trùng. |

### Loại biên bản (BB Type)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/bb-types` | 🔒 | Danh sách loại biên bản. |
| POST | `/api/bb-types` | 👑 | Tạo loại biên bản. Body `{ code, name }`. |
| PUT | `/api/bb-types/:id` | 👑 | Cập nhật loại biên bản. |
| DELETE | `/api/bb-types/:id` | 👑 | Xóa loại biên bản. |

---

## 6. Hợp đồng bán (Contract Out)

> Danh sách hợp đồng được lọc theo PM với user non-admin. Ghi/sửa một hợp đồng chỉ
> dành cho PM của hợp đồng đó (hoặc admin).

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts` | 🔒 | Danh sách hợp đồng (non-admin chỉ thấy HĐ mình là PM). |
| GET | `/api/contracts/:id` | 🔒 | Chi tiết hợp đồng. |
| POST | `/api/contracts` | 🔒 | Tạo hợp đồng mới. |
| PUT | `/api/contracts/:id` | 🏗️ | Cập nhật hợp đồng (gồm danh sách thành viên/PM). |
| POST | `/api/contracts/check-contract-no` | 🔒 | Kiểm tra số hợp đồng trùng. |

### BOQ (bảng khối lượng) hợp đồng bán

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/boq/template` | 🔒 | Tải file Excel mẫu nhập BOQ. |
| GET | `/api/contracts/:contractId/boq` | 🔒 | Danh sách dòng BOQ của hợp đồng. |
| POST | `/api/contracts/:contractId/boq` | 🏗️ | Thêm một dòng BOQ. |
| POST | `/api/contracts/:contractId/boq/after/:refId` | 🏗️ | Chèn dòng BOQ sau dòng `refId`. |
| POST | `/api/contracts/:contractId/boq/reorder` | 🏗️ | Sắp xếp lại thứ tự BOQ. |
| POST | `/api/contracts/:contractId/boq/import` | 🏗️ | Upload Excel để xem trước (`multipart`, field `file`). |
| POST | `/api/contracts/:contractId/boq/save-import` | 🏗️ | Lưu dữ liệu BOQ đã import. |
| PUT | `/api/boq/:id` | 🏗️ | Cập nhật một dòng BOQ. |
| DELETE | `/api/boq/:id` | 🏗️ | Xóa một dòng BOQ. |
| POST | `/api/boq/bulk-delete` | 🏗️ | Xóa nhiều dòng. Body `{ ids: [...] }`. |

> **Lưu ý đơn vị tiền:** giá trị BOQ lưu theo **nguyên tệ của hợp đồng** (vd USD), không
> phải VND. `currency_code` + `exchange_rate` chỉ để quy đổi hiển thị sang VND.

### Tiến độ (Progress) — hợp đồng bán

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:contractId/progress` | 🔒 | Danh sách mốc tiến độ (biên bản). |
| POST | `/api/contracts/:contractId/progress` | 🏗️ | Thêm mốc tiến độ. |
| PUT | `/api/progress/:id` | 🏗️ | Cập nhật mốc tiến độ. |
| DELETE | `/api/progress/:id` | 🏗️ | Xóa mốc tiến độ. |

### Công nợ phải thu (Receivable)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:contractId/receivable` | 🔒 | Lịch thu tiền theo hợp đồng. |
| POST | `/api/contracts/:contractId/receivable` | 🏗️ | Thêm dòng lịch thu. |
| PUT | `/api/receivable/:id` | 🏗️ | Cập nhật dòng lịch thu. |
| DELETE | `/api/receivable/:id` | 🏗️ | Xóa dòng lịch thu. |
| GET | `/api/contracts/:contractId/receivable-payments` | 🔒 | Danh sách lần thu thực tế. |
| POST | `/api/contracts/:contractId/receivable-payments` | 🏗️ | Ghi nhận một lần thu. |
| PUT | `/api/receivable-payments/:id` | 🏗️ | Cập nhật một lần thu. |
| DELETE | `/api/receivable-payments/:id` | 🏗️ | Xóa một lần thu. |

> Mọi tính toán công nợ (tổng, tỷ lệ, còn thiếu) dựa trên giá trị **nguyên tệ** `amount`;
> cột quy đổi VND chỉ để hiển thị.

### Bảo lãnh (Guarantee) — hợp đồng bán

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:id/guarantees` | 🔒 | Danh sách bảo lãnh. |
| POST | `/api/contracts/:id/guarantees` | 🏗️ | Thêm bảo lãnh. |
| PUT | `/api/guarantees/:id` | 🏗️ | Cập nhật bảo lãnh. |
| DELETE | `/api/guarantees/:id` | 🏗️ | Xóa bảo lãnh. |

### Công việc (Task)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:id/tasks` | 🔒 | Danh sách công việc của hợp đồng. |
| POST | `/api/contracts/:id/tasks` | 🏗️ | Thêm công việc. |
| PUT | `/api/tasks/:id` | 🏗️ | Cập nhật công việc. |
| DELETE | `/api/tasks/:id` | 🏗️ | Xóa công việc. |
| GET | `/api/tasks/:taskId/attachments` | 🔒 | Danh sách tệp đính kèm của công việc. |
| POST | `/api/tasks/:taskId/attachments` | 🏗️ | Đính kèm tệp (`multipart`, field `file`). |
| DELETE | `/api/task-attachments/:id` | 🏗️ | Xóa tệp đính kèm. |

---

## 7. Tài liệu (Document)

> Quản lý cây thư mục + tệp tài liệu cho cả hợp đồng bán và hợp đồng nhập.

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:contractId/folders` | 🔒 | Cây thư mục của hợp đồng bán. |
| POST | `/api/contracts/:contractId/folders` | 🏗️ | Tạo thư mục. |
| PUT | `/api/folders/:folderId` | 🏗️ | Đổi tên/di chuyển thư mục. |
| DELETE | `/api/folders/:folderId` | 🏗️ | Xóa thư mục (cascade tệp con). |
| GET | `/api/contracts/:contractId/files` | 🔒 | Danh sách tệp của hợp đồng. |
| GET | `/api/folders/:folderId/files` | 🔒 | Danh sách tệp trong một thư mục. |
| POST | `/api/contracts/:contractId/files/upload` | 🏗️ | Upload tệp (`multipart`, field `file`). |
| GET | `/api/files/:fileId/view` | 🔒 | Xem tệp inline (preview). |
| GET | `/api/files/:fileId/download` | 🔒 | Tải tệp về (đính kèm). |
| DELETE | `/api/files/:fileId` | 🏗️ | Xóa tệp. |
| GET | `/api/contract-ins/:contractInId/folders` | 🔒 | Cây thư mục của hợp đồng nhập. |
| POST | `/api/contract-ins/:contractInId/folders` | 🏗️ | Tạo thư mục (HĐ nhập). |
| GET | `/api/contract-ins/:contractInId/files` | 🔒 | Danh sách tệp (HĐ nhập). |
| POST | `/api/contract-ins/:contractInId/files/upload` | 🏗️ | Upload tệp (HĐ nhập). |

---

## 8. Bảo hành — Thiết bị & Serial

> Quản lý thiết bị, serial linh kiện, vụ việc bảo hành theo hợp đồng bán.

### Tra cứu serial

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/warranty-lookup?serial=...` | 🔒 | Tra cứu serial liên hợp đồng → HĐ bán/nhập, khách hàng/NCC, hạn bảo hành. |

### Thiết bị (Equipment)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:id/equipment` | 🔒 | Danh sách thiết bị của hợp đồng. |
| POST | `/api/contracts/:id/equipment` | 🏗️ | Thêm thiết bị. |
| POST | `/api/contracts/:id/equipment/import` | 🏗️ | Import thiết bị hàng loạt. |
| PUT | `/api/equipment/:id` | 🏗️ | Cập nhật thiết bị. |
| DELETE | `/api/equipment/:id` | 🏗️ | Xóa thiết bị. |
| PUT | `/api/equipment/bulk-warranty` | 🏗️ | Cập nhật bảo hành hàng loạt. Body `{ ids: [...] }`. |

### Serial

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/equipment/:id/serials` | 🔒 | Danh sách serial của thiết bị. |
| POST | `/api/equipment/:id/serials` | 🏗️ | Thêm serial. |
| POST | `/api/contracts/:id/serials/import` | 🏗️ | Import serial linh kiện hàng loạt. |
| PUT | `/api/serials/:id` | 🏗️ | Cập nhật serial. |
| DELETE | `/api/serials/:id` | 🏗️ | Xóa serial. |
| PUT | `/api/serials/bulk-warranty` | 🏗️ | Cập nhật bảo hành serial hàng loạt. Body `{ ids: [...] }`. |
| POST | `/api/serials/bulk-delete` | 🏗️ | Xóa serial hàng loạt. Body `{ ids: [...] }`. |
| POST | `/api/serials/:id/replace` | 🏗️ | Thay thế serial (đổi serial mới). |

> Serial là **duy nhất theo từng phía** (nhập / bán) trên toàn hệ thống, không phân biệt
> hoa thường; hai phía có thể trùng nhau.

### Vụ việc bảo hành (Warranty Case)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:id/warranty-cases` | 🔒 | Danh sách vụ việc bảo hành. |
| POST | `/api/contracts/:id/warranty-cases` | 🏗️ | Tạo vụ việc. |
| PUT | `/api/warranty-cases/:id` | 🏗️ | Cập nhật vụ việc. |
| DELETE | `/api/warranty-cases/:id` | 🏗️ | Xóa vụ việc. |
| GET | `/api/warranty-cases/:id/equipment` | 🔒 | Thiết bị gắn với vụ việc. |
| POST | `/api/warranty-cases/:id/equipment` | 🏗️ | Gắn thiết bị vào vụ việc. |
| DELETE | `/api/warranty-case-equipment/:id` | 🏗️ | Gỡ thiết bị khỏi vụ việc. |
| GET | `/api/warranty-cases/:id/activities` | 🔒 | Nhật ký xử lý của vụ việc. |
| POST | `/api/warranty-cases/:id/activities` | 🏗️ | Thêm hoạt động xử lý. |
| DELETE | `/api/warranty-activities/:id` | 🏗️ | Xóa hoạt động. |
| GET | `/api/contracts/:id/warranty-activities` | 🔒 | Toàn bộ hoạt động bảo hành của hợp đồng. |

---

## 9. Hợp đồng nhập (Contract In)

> Hợp đồng nhập là con của một hợp đồng bán. Quyền ghi theo PM của **hợp đồng bán cha**.

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contracts/:id/contract-ins` | 🔒 | Danh sách hợp đồng nhập thuộc HĐ bán. |
| POST | `/api/contracts/:id/contract-ins` | 🏗️ | Tạo hợp đồng nhập. |
| PUT | `/api/contract-ins/:id` | 🏗️ | Cập nhật hợp đồng nhập. |
| DELETE | `/api/contract-ins/:id` | 🏗️ | Xóa hợp đồng nhập. |

### BOQ mua (Purchase BOQ)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/purchase-boq/template` | 🔒 | Tải Excel mẫu BOQ mua. |
| GET | `/api/contract-ins/:contractInId/boq` | 🔒 | Danh sách BOQ mua. |
| POST | `/api/contract-ins/:contractInId/boq` | 🏗️ | Thêm dòng BOQ mua. |
| POST | `/api/contract-ins/:contractInId/boq/after/:refId` | 🏗️ | Chèn dòng sau `refId`. |
| POST | `/api/contract-ins/:contractInId/boq/reorder` | 🏗️ | Sắp xếp lại. |
| POST | `/api/contract-ins/:contractInId/boq/import` | 🏗️ | Import Excel (xem trước). |
| POST | `/api/contract-ins/:contractInId/boq/save-import` | 🏗️ | Lưu dữ liệu đã import. |
| PUT | `/api/purchase-boq/:id` | 🏗️ | Cập nhật dòng BOQ mua. |
| DELETE | `/api/purchase-boq/:id` | 🏗️ | Xóa dòng BOQ mua. |
| POST | `/api/purchase-boq/bulk-delete` | 🏗️ | Xóa nhiều dòng. Body `{ ids: [...] }`. |

### Giao hàng (Delivery)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/deliveries` | 🔒 | Danh sách đợt giao hàng. |
| POST | `/api/contract-ins/:contractInId/deliveries` | 🏗️ | Tạo đợt giao hàng. |
| PUT | `/api/deliveries/:id` | 🏗️ | Cập nhật đợt giao hàng. |
| DELETE | `/api/deliveries/:id` | 🏗️ | Xóa đợt giao hàng. |
| GET | `/api/deliveries/:deliveryId/items` | 🔒 | Danh sách dòng hàng trong đợt. |
| POST | `/api/deliveries/:deliveryId/items` | 🏗️ | Thêm dòng hàng. |
| PUT | `/api/delivery-items/:id` | 🏗️ | Cập nhật dòng hàng. |
| DELETE | `/api/delivery-items/:id` | 🏗️ | Xóa dòng hàng. |
| GET | `/api/delivery-items/:itemId/serials` | 🔒 | Serial của dòng hàng. |
| POST | `/api/delivery-items/:itemId/serials` | 🏗️ | Thêm serial giao hàng. |
| POST | `/api/delivery-items/:itemId/serials/import` | 🏗️ | Import serial từ Excel. |
| PUT | `/api/delivery-serials/:id` | 🏗️ | Cập nhật serial giao hàng. |
| DELETE | `/api/delivery-serials/:id` | 🏗️ | Xóa serial giao hàng. |
| POST | `/api/delivery-serials/:id/replace` | 🏗️ | Thay thế serial giao hàng. |
| POST | `/api/delivery-serials/bulk-delete` | 🏗️ | Xóa nhiều serial. Body `{ ids: [...] }`. |
| GET | `/api/contract-ins/:contractInId/all-serials` | 🔒 | Toàn bộ serial giao hàng của HĐ nhập. |
| GET | `/api/contract-ins/:contractInId/all-items` | 🔒 | Toàn bộ dòng hàng của HĐ nhập. |

### Công nợ phải trả NCC (Payable)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/payables` | 🔒 | Lịch phải trả. |
| POST | `/api/contract-ins/:contractInId/payables` | 🏗️ | Thêm dòng phải trả. |
| PUT | `/api/payables/:id` | 🏗️ | Cập nhật dòng phải trả. |
| DELETE | `/api/payables/:id` | 🏗️ | Xóa dòng phải trả. |
| GET | `/api/contract-ins/:contractInId/payments` | 🔒 | Danh sách lần trả thực tế. |
| POST | `/api/contract-ins/:contractInId/payments` | 🏗️ | Ghi nhận lần trả. |
| PUT | `/api/payments/:id` | 🏗️ | Cập nhật lần trả. |
| DELETE | `/api/payments/:id` | 🏗️ | Xóa lần trả. |

### Bảo hành nhà cung cấp (Supplier Warranty)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/supplier-warranty` | 🔒 | Danh sách bảo hành NCC. |
| POST | `/api/contract-ins/:contractInId/supplier-warranty` | 🏗️ | Thêm bảo hành NCC. |
| POST | `/api/contract-ins/:contractInId/supplier-warranty/init` | 🏗️ | Khởi tạo bảo hành từ dữ liệu giao hàng. |
| POST | `/api/contract-ins/:contractInId/supplier-warranty/bulk-update` | 🏗️ | Cập nhật mốc bắt đầu hàng loạt. |
| PUT | `/api/supplier-warranty/:id` | 🏗️ | Cập nhật bảo hành NCC. |
| DELETE | `/api/supplier-warranty/:id` | 🏗️ | Xóa bảo hành NCC. |
| GET | `/api/contract-ins/:contractInId/warranty-claims` | 🔒 | Danh sách yêu cầu bảo hành (claim). |
| POST | `/api/contract-ins/:contractInId/warranty-claims` | 🏗️ | Tạo claim. |
| PUT | `/api/warranty-claims/:id` | 🏗️ | Cập nhật claim. |
| DELETE | `/api/warranty-claims/:id` | 🏗️ | Xóa claim. |

### Bảo lãnh — hợp đồng nhập

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/guarantees` | 🔒 | Danh sách bảo lãnh (HĐ nhập). |
| POST | `/api/contract-ins/:contractInId/guarantees` | 🏗️ | Thêm bảo lãnh. |
| PUT | `/api/contract-in-guarantees/:id` | 🏗️ | Cập nhật bảo lãnh. |
| DELETE | `/api/contract-in-guarantees/:id` | 🏗️ | Xóa bảo lãnh. |

### Hải quan (Customs)

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/customs` | 🔒 | Thông tin hải quan của HĐ nhập. |
| POST | `/api/contract-ins/:contractInId/customs` | 🏗️ | Thêm bản ghi hải quan. |
| PUT | `/api/contract-in-customs/:id` | 🏗️ | Cập nhật. |
| DELETE | `/api/contract-in-customs/:id` | 🏗️ | Xóa. |

### Logistics

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/logistics` | 🔒 | Danh sách lô logistics. |
| POST | `/api/contract-ins/:contractInId/logistics` | 🏗️ | Tạo lô logistics. |
| PUT | `/api/contract-in-logistics/:id` | 🏗️ | Cập nhật lô logistics. |
| DELETE | `/api/contract-in-logistics/:id` | 🏗️ | Xóa lô logistics. |
| GET | `/api/contract-in-logistics/:id/updates` | 🔒 | Lịch sử cập nhật trạng thái của lô. |
| POST | `/api/contract-in-logistics/:id/updates` | 🏗️ | Thêm cập nhật trạng thái. |
| DELETE | `/api/contract-in-logistics-updates/:id` | 🏗️ | Xóa một cập nhật. |

### Tiến độ — hợp đồng nhập

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/contract-ins/:contractInId/progress` | 🔒 | Danh sách mốc tiến độ (HĐ nhập). |
| POST | `/api/contract-ins/:contractInId/progress` | 🏗️ | Thêm mốc tiến độ. |
| PUT | `/api/progress-in/:id` | 🏗️ | Cập nhật mốc tiến độ. |
| DELETE | `/api/progress-in/:id` | 🏗️ | Xóa mốc tiến độ. |

---

## 10. PM Dashboard

| Method | Path | Quyền | Mô tả |
|--------|------|-------|-------|
| GET | `/api/pm/:userId/dashboard` | 👤 | Tổng quan hợp đồng/công nợ/công việc của một PM. |
| PUT | `/api/pm/:userId/tracking` | 👤 | Cập nhật ghim/nhắc việc cá nhân của PM. |

---

## Phụ lục — Upload file

Các endpoint upload nhận `multipart/form-data` với một field tên **`file`**:

```http
POST /api/contracts/123/files/upload
Content-Type: multipart/form-data

file: <binary>
```

- Phần mở rộng nguy hiểm (thực thi / render HTML như `.html`, `.svg`, `.shtml`...) bị chặn.
- Tệp đính kèm tối đa 50MB; file Excel import 5–10MB.
- Tệp được phục vụ qua `/api/files/:id/view` (xem) hoặc `/download` (tải về) — không
  phục vụ trực tiếp theo đường dẫn đoán được.
