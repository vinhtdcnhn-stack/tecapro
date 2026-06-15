# Tài liệu Use Case — Hệ thống Quản lý Hợp đồng & Dự án

Mô tả các tình huống sử dụng (use case) chính của hệ thống theo từng nhóm người dùng.

---

## 1. Tác nhân (Actors)

| Tác nhân | Mô tả | Cách xác định |
|----------|-------|---------------|
| **Quản trị viên (Admin)** | Toàn quyền: quản lý người dùng, danh mục dùng chung, và mọi hợp đồng. | `role = 1` |
| **Giám đốc / Phó GĐ** | Xem dashboard tổng quan toàn công ty (hợp đồng, khách hàng, nhân sự). | Chức vụ `GD` / `PGD` |
| **Quản lý dự án (PM)** | Quản lý các hợp đồng mình phụ trách: tạo, sửa, xóa toàn bộ dữ liệu bên trong. | Là thành viên `PM` của hợp đồng (`contract_out_member.member_role = 'PM'`) |
| **Nhân viên** | Người dùng đã đăng nhập nhưng không phải PM của hợp đồng đang xem: chỉ xem và tra cứu. | Đã đăng nhập, không thuộc nhóm trên |

> **Nguyên tắc phân quyền:** Đọc (xem) mở cho mọi người dùng đã đăng nhập. Ghi (tạo/sửa/xóa)
> dữ liệu bên trong một hợp đồng chỉ dành cho PM của hợp đồng đó hoặc admin. Quản trị
> người dùng và danh mục dùng chung chỉ dành cho admin.

---

## 2. Sơ đồ tổng quan use case

```
                         ┌─────────────────────────────┐
                         │   Hệ thống QL Hợp đồng       │
                         └─────────────────────────────┘
  Admin ───────► Quản trị người dùng, danh mục (KH/NCC/loại BB)
  Admin/PM ────► Tạo & quản lý hợp đồng bán, hợp đồng nhập
  PM ──────────► BOQ, tiến độ, công nợ, bảo lãnh, công việc, tài liệu, bảo hành
  GD/PGD ──────► Xem dashboard tổng quan
  Mọi NV ──────► Đăng nhập, xem hợp đồng, tra cứu serial bảo hành, đổi mật khẩu
```

---

## 3. Use case theo nhóm

### Nhóm A — Xác thực & tài khoản

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-A1 | Đăng nhập | Mọi NV |
| UC-A2 | Đăng xuất | Mọi NV |
| UC-A3 | Đổi mật khẩu cá nhân | Mọi NV |
| UC-A4 | Quản lý người dùng (tạo/sửa/phân quyền) | Admin |

### Nhóm B — Danh mục dùng chung

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-B1 | Quản lý khách hàng | Admin |
| UC-B2 | Quản lý nhà cung cấp | Admin |
| UC-B3 | Quản lý loại biên bản (BB Type) | Admin |

### Nhóm C — Hợp đồng bán

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-C1 | Tạo hợp đồng bán mới | Admin/PM |
| UC-C2 | Xem danh sách hợp đồng | Mọi NV (lọc theo PM nếu non-admin) |
| UC-C3 | Xem chi tiết hợp đồng | Mọi NV |
| UC-C4 | Cập nhật hợp đồng & thành viên | PM/Admin |
| UC-C5 | Lập & quản lý BOQ | PM/Admin |
| UC-C6 | Theo dõi tiến độ (biên bản) | PM/Admin |
| UC-C7 | Quản lý công nợ phải thu | PM/Admin |
| UC-C8 | Quản lý bảo lãnh | PM/Admin |
| UC-C9 | Quản lý công việc & đính kèm | PM/Admin |
| UC-C10 | Quản lý tài liệu (thư mục/tệp) | PM/Admin |
| UC-C11 | Quản lý thiết bị, serial & bảo hành | PM/Admin |

### Nhóm D — Hợp đồng nhập

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-D1 | Tạo hợp đồng nhập (thuộc HĐ bán) | PM/Admin |
| UC-D2 | Lập BOQ mua | PM/Admin |
| UC-D3 | Quản lý giao hàng & serial | PM/Admin |
| UC-D4 | Quản lý công nợ phải trả NCC | PM/Admin |
| UC-D5 | Quản lý bảo hành NCC & yêu cầu bảo hành | PM/Admin |
| UC-D6 | Quản lý bảo lãnh, hải quan, logistics, tiến độ | PM/Admin |

### Nhóm E — Tra cứu & báo cáo

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-E1 | Tra cứu serial bảo hành | Mọi NV |
| UC-E2 | Xem dashboard cá nhân (PM) | PM / thành viên dự án |
| UC-E3 | Xem dashboard tổng quan | GD/PGD |

### Nhóm F — Đề xuất / Phê duyệt (giống Base Request)

| Mã | Use case | Tác nhân |
|----|----------|----------|
| UC-F1 | Cấu hình loại đơn (form builder: trường + chuỗi bước duyệt + người duyệt) | Admin |
| UC-F2 | Tạo & gửi đơn đề xuất (chọn loại đơn, điền trường động, đính kèm) | Mọi NV |
| UC-F3 | Duyệt / từ chối đơn ở bước tới lượt mình | Người duyệt được cấu hình |
| UC-F4 | Theo dõi đơn của tôi / hủy đơn đang chờ | Người gửi |
| UC-F5 | Xem hộp "Chờ tôi duyệt" + tiến trình duyệt (timeline) | Người duyệt |

#### UC-F1 — Cấu hình loại đơn
- **Tác nhân:** Admin
- **Luồng chính:** Admin tạo loại đơn (mã, tên, icon), thêm/bớt **trường** (văn bản, số,
  số tiền, ngày, khoảng ngày, chọn một, có/không, nhân viên, tệp) và **chuỗi bước duyệt
  tuần tự**, mỗi bước gán một/nhiều người duyệt (quy tắc: một người duyệt là đủ / cần tất cả).
- **Ghi chú:** Có thể "Ngừng dùng" loại đơn; không xóa được khi đã phát sinh đơn.

#### UC-F2 — Tạo & gửi đơn
- **Tác nhân:** Mọi nhân viên đã đăng nhập
- **Luồng chính:** Chọn loại đơn → form hiển thị đúng các trường đã cấu hình → điền, lưu nháp
  hoặc gửi duyệt. Khi gửi, hệ thống **chụp** chuỗi bước duyệt hiện hành và chuyển đơn tới người
  duyệt bước đầu (thông báo Telegram nếu có).
- **Ngoại lệ:** Thiếu trường bắt buộc → không gửi được.

#### UC-F3 — Duyệt / từ chối
- **Tác nhân:** Người duyệt được cấu hình cho bước hiện tại
- **Luồng chính:** Mở đơn trong hộp "Chờ tôi duyệt", xem dữ liệu + tiến trình, nhập ý kiến,
  Duyệt (sang bước kế hoặc hoàn tất) hoặc Từ chối (đơn bị từ chối, báo người gửi).
- **Ngoại lệ:** Không phải người duyệt của bước hiện tại / đã xử lý → bị từ chối (403/409).

---

## 4. Mô tả chi tiết các use case chính

### UC-A1 — Đăng nhập

- **Tác nhân:** Mọi nhân viên
- **Tiền điều kiện:** Có tài khoản (email + mật khẩu) đã được admin tạo.
- **Luồng chính:**
  1. Người dùng nhập email và mật khẩu tại màn hình đăng nhập.
  2. Hệ thống kiểm tra thông tin; nếu đúng, tạo phiên đăng nhập (cookie `httpOnly`).
  3. Chuyển vào trang chủ phù hợp với vị trí/vai trò.
- **Luồng phụ / ngoại lệ:**
  - Sai email hoặc mật khẩu → báo lỗi chung "Sai email hoặc mật khẩu." (không phân biệt).
  - Sai quá 10 lần trong 15 phút từ cùng một IP → tạm khóa đăng nhập.
  - Nếu tài khoản có cấu hình Telegram → gửi thông báo đăng nhập về cá nhân.
- **Hậu điều kiện:** Người dùng có phiên hợp lệ trong 7 ngày.

### UC-A3 — Đổi mật khẩu cá nhân

- **Tác nhân:** Mọi nhân viên (đổi của chính mình); Admin có thể đặt lại hộ.
- **Luồng chính:**
  1. Người dùng mở chức năng đổi mật khẩu, nhập mật khẩu hiện tại + mật khẩu mới.
  2. Hệ thống xác minh mật khẩu hiện tại, kiểm tra mật khẩu mới ≥ 8 ký tự.
  3. Cập nhật mật khẩu và **vô hiệu hóa mọi phiên đăng nhập cũ** của tài khoản.
- **Ngoại lệ:** Mật khẩu hiện tại sai / mật khẩu mới quá ngắn → báo lỗi, không đổi.
- **Hậu điều kiện:** Các thiết bị khác bị đăng xuất; thiết bị đang thao tác vẫn giữ phiên.

### UC-A4 — Quản lý người dùng

- **Tác nhân:** Admin
- **Luồng chính:**
  1. Admin xem danh sách người dùng (đầy đủ thông tin: email, SĐT, mã NV...).
  2. Tạo người dùng mới (email, mật khẩu, phòng ban, chức vụ, vai trò) — hệ thống kiểm tra trùng email/username/mã NV.
  3. Cập nhật thông tin hoặc đổi vai trò người dùng; có thể đặt lại mật khẩu.
- **Lưu ý:** Người dùng non-admin khi xem danh sách bị ẩn các thông tin nhạy cảm.

### UC-B1/B2/B3 — Quản lý danh mục dùng chung

- **Tác nhân:** Admin
- **Luồng chính:**
  1. Admin mở mục quản trị tương ứng (khách hàng / NCC / loại biên bản).
  2. Thêm mới (kiểm tra trùng mã), sửa, hoặc xóa bản ghi.
- **Lưu ý:** Người dùng thường vẫn **xem** được các danh mục này khi nhập liệu hợp đồng,
  nhưng không thêm/sửa/xóa được; nút quản lý bị ẩn ở giao diện.

### UC-C1 — Tạo hợp đồng bán mới

- **Tác nhân:** Admin / PM
- **Tiền điều kiện:** Đã có khách hàng trong danh mục.
- **Luồng chính:**
  1. Người dùng mở form tạo hợp đồng, nhập số HĐ, khách hàng, giá trị, loại tiền tệ + tỷ giá, ngày ký...
  2. Hệ thống kiểm tra số hợp đồng không trùng.
  3. Gán thành viên dự án, trong đó có (các) PM phụ trách.
  4. Lưu hợp đồng; mặc định cây thư mục tài liệu để trống.
- **Hậu điều kiện:** Hợp đồng xuất hiện trong danh sách; PM được phân quyền chỉnh sửa.
- **Ghi chú nghiệp vụ:** Giá trị tiền lưu theo **nguyên tệ của hợp đồng** (vd USD); tỷ giá
  chỉ dùng để quy đổi hiển thị sang VND.

### UC-C2 — Xem danh sách hợp đồng

- **Tác nhân:** Mọi nhân viên
- **Luồng chính:**
  1. Người dùng mở trang danh sách hợp đồng, có thể lọc theo khoảng thời gian.
  2. Admin thấy mọi hợp đồng; người dùng thường chỉ thấy hợp đồng mình là PM/thành viên.

### UC-C4 — Cập nhật hợp đồng & thành viên

- **Tác nhân:** PM của hợp đồng / Admin
- **Luồng chính:**
  1. PM mở chi tiết hợp đồng, chỉnh sửa thông tin chung hoặc danh sách thành viên/PM.
  2. Hệ thống lưu thay đổi.
- **Ngoại lệ:** Người dùng không phải PM của hợp đồng → bị từ chối (403); nút sửa bị ẩn/khóa ở UI.

### UC-C5 — Lập & quản lý BOQ

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM mở tab BOQ của hợp đồng.
  2. Thêm/sửa/xóa từng dòng, chèn dòng, sắp xếp lại thứ tự; nhập đơn giá, khối lượng.
  3. Hoặc tải file Excel mẫu, điền, **import** lên (xem trước rồi lưu).
- **Ngoại lệ:** File Excel sai định dạng → báo lỗi, không lưu.
- **Ghi chú:** Tiền được làm tròn theo loại tiền tệ khi lưu (VND → số nguyên, ngoại tệ → 2 số lẻ).

### UC-C6 — Theo dõi tiến độ (biên bản)

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM mở tab Tiến độ, thêm các mốc biên bản (theo loại biên bản trong danh mục).
  2. Nhập ngày theo hợp đồng và ngày thực tế; hệ thống tính trạng thái (đúng hạn/trễ/quá hạn).
- **Mở rộng:** Chỉ admin được thêm/sửa **loại biên bản** dùng chung (nút "Quản lý loại BB" ẩn với non-admin).

### UC-C7 — Quản lý công nợ phải thu

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM lập lịch thu tiền theo các đợt (số tiền, % theo hợp đồng, thời hạn).
  2. Ghi nhận các lần thu thực tế; hệ thống tính tỷ lệ đã thu / còn thiếu.
- **Ghi chú:** Mọi tính toán dựa trên giá trị **nguyên tệ**; cột quy đổi VND chỉ để hiển thị.

### UC-C9 — Quản lý công việc & đính kèm

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM tạo công việc cho hợp đồng (theo phòng ban, người phụ trách, hạn).
  2. Đính kèm tệp cho công việc; cập nhật trạng thái; xóa khi cần.

### UC-C10 — Quản lý tài liệu

- **Tác nhân:** PM / Admin (ghi); mọi NV (xem/tải)
- **Luồng chính:**
  1. PM tạo cây thư mục, upload tệp vào thư mục.
  2. Người dùng xem trước (preview) hoặc tải tệp về.
  3. PM có thể đổi tên/di chuyển thư mục, xóa tệp/thư mục.
- **Ngoại lệ:** Tệp có phần mở rộng nguy hiểm (thực thi / có thể chạy script) bị từ chối khi upload.

### UC-C11 — Quản lý thiết bị, serial & bảo hành

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM khai báo thiết bị của hợp đồng (thêm tay hoặc import).
  2. Khai báo serial cho từng thiết bị; đặt thông tin bảo hành (có thể cập nhật hàng loạt).
  3. Khi phát sinh sự cố, tạo **vụ việc bảo hành**, gắn thiết bị liên quan, ghi nhật ký xử lý.
  4. Khi cần, **thay thế serial** (đổi sang serial mới).
- **Ghi chú:** Serial là duy nhất theo từng phía (nhập/bán) trên toàn hệ thống, không phân biệt hoa thường.

### UC-D1 — Tạo hợp đồng nhập

- **Tác nhân:** PM / Admin
- **Tiền điều kiện:** Đã có hợp đồng bán cha và nhà cung cấp.
- **Luồng chính:**
  1. Trong chi tiết hợp đồng bán, PM mở tab Hợp đồng nhập và tạo HĐ nhập mới (gắn NCC).
  2. Lưu; quyền chỉnh sửa HĐ nhập theo PM của **hợp đồng bán cha**.

### UC-D3 — Quản lý giao hàng & serial

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM tạo các đợt giao hàng, thêm dòng hàng cho từng đợt.
  2. Khai báo serial cho từng dòng hàng (thêm tay hoặc import Excel).
  3. Cập nhật/xóa/thay thế serial; xem toàn bộ serial & dòng hàng của hợp đồng nhập.

### UC-D5 — Quản lý bảo hành NCC & yêu cầu bảo hành

- **Tác nhân:** PM / Admin
- **Luồng chính:**
  1. PM khởi tạo danh sách bảo hành NCC từ dữ liệu giao hàng (hoặc thêm tay).
  2. Cập nhật mốc bắt đầu bảo hành (có thể hàng loạt).
  3. Khi cần đòi bảo hành, tạo **yêu cầu bảo hành (claim)** và theo dõi xử lý.

### UC-E1 — Tra cứu serial bảo hành

- **Tác nhân:** Mọi nhân viên đã đăng nhập
- **Luồng chính:**
  1. Người dùng nhập serial cần tra.
  2. Hệ thống trả về: hợp đồng bán/nhập liên quan, khách hàng/NCC, hạn bảo hành.
- **Ghi chú:** Đây là tra cứu **liên hợp đồng** có chủ đích — không bị giới hạn theo membership.

### UC-E2 — Dashboard cá nhân (PM)

- **Tác nhân:** PM / thành viên dự án
- **Luồng chính:**
  1. Khi vào trang chủ, PM thấy bảng theo dõi tiến độ các dự án mình phụ trách.
  2. Có thể ghim/nhắc việc cá nhân (chỉ tác động đến dữ liệu theo dõi của chính mình).

### UC-E3 — Dashboard tổng quan

- **Tác nhân:** Giám đốc / Phó giám đốc
- **Luồng chính:**
  1. Khi vào trang chủ, GD/PGD thấy tổng quan toàn công ty: số hợp đồng, khách hàng, nhân sự, các chỉ số chính.

---

## 5. Ma trận quyền truy cập (tóm tắt)

| Chức năng | Admin | PM (của HĐ) | NV thường |
|-----------|:-----:|:-----------:|:---------:|
| Đăng nhập / đổi mật khẩu cá nhân | ✅ | ✅ | ✅ |
| Quản lý người dùng | ✅ | ❌ | ❌ |
| Quản lý danh mục (KH/NCC/loại BB) | ✅ | ❌ | ❌ |
| Tạo hợp đồng | ✅ | ✅ | ✅ |
| Xem hợp đồng | ✅ (tất cả) | ✅ | ✅ (HĐ mình tham gia) |
| Sửa/xóa dữ liệu trong hợp đồng | ✅ | ✅ (HĐ mình là PM) | ❌ |
| Tra cứu serial bảo hành | ✅ | ✅ | ✅ |
| Dashboard tổng quan | ✅ | tùy vị trí | tùy vị trí |
| Cấu hình loại đơn (form builder) | ✅ | ❌ | ❌ |
| Tạo & gửi đơn đề xuất | ✅ | ✅ | ✅ |
| Duyệt/từ chối đơn | ✅ (nếu là người duyệt) | ✅ (nếu là người duyệt) | ✅ (nếu là người duyệt) |
