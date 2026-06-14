# Hướng dẫn sử dụng — Module Quản lý công việc Ban KT Cơ điện

Module giúp Ban KT Cơ điện quản lý công việc của phòng (không gắn hợp đồng): giao việc cho
nhiều người, chỉ định nhóm trưởng, chuyển việc giữa các thành viên, đẩy việc lên cấp trên khi
vướng mắc, báo cáo vấn đề khi triển khai, ghi nhật ký hằng ngày và xem báo cáo năng lực.

---

## 1. Ai được dùng và quyền hạn

Chỉ **thành viên Ban KT Cơ điện** hoặc **admin** mới vào được module. Trong module có 3 vai trò:

| Vai trò | Quyền |
|---------|-------|
| **Trưởng/Phó phòng** (HEAD/DEPUTY) hoặc **Admin** | Toàn quyền: tạo/sửa/xóa việc, giao việc cho nhiều người, chỉ định nhóm trưởng, đổi trạng thái mọi việc, xem nhật ký & năng lực của tất cả mọi người, xử lý việc bị đẩy lên, đánh dấu vấn đề đã xử lý. |
| **Nhân viên** (MEMBER) | Tạo **việc khách hàng** (tự nhận, tự làm nhóm trưởng); với việc mình đang nhận: đổi trạng thái (nếu là nhóm trưởng của việc), chuyển việc, đẩy cấp trên, báo vấn đề, đính kèm tệp; ghi/sửa nhật ký của chính mình; xem năng lực của chính mình. |

> Trong tài liệu này, **"người quản lý"** = Trưởng/Phó phòng hoặc Admin.

---

## 2. Truy cập module

Trên thanh menu trên cùng, chọn **Công việc → KT Cơ điện**.
(Menu này chỉ hiện với admin và thành viên Ban KT Cơ điện.)

Module có 4 mục ở thanh bên (mobile là tab ngang):

- **Bảng công việc** — danh sách & quản lý việc
- **Nhật ký công việc** — ghi việc làm hằng ngày
- **Năng lực** — báo cáo giờ công / hiệu suất
- **Quản lý nhóm** — (chỉ người quản lý; đang phát triển)

---

## 3. Bảng công việc

### 3.1 Xem & lọc

Danh sách hiển thị: tên việc, người nhận (★ = nhóm trưởng), ưu tiên, hạn, trạng thái.
Các nhãn phụ dưới tên việc: **KH** (việc nguồn khách hàng), tên nhóm (Presale/Postsale),
**Đã đẩy cấp trên**, **⚠ N vấn đề** (số vấn đề đang mở). Việc **quá hạn** được tô đỏ.

Lọc nhanh theo trạng thái: *Tất cả · Chờ xử lý · Đang thực hiện · Hoàn thành*.

Bấm vào **tên việc** để mở khung chi tiết bên phải (mobile: toàn màn hình).

### 3.2 Tạo công việc

Bấm **+ Thêm công việc**.

**Người quản lý** điền form đầy đủ:
- **Tên công việc** (bắt buộc), Mô tả, Chỉ đạo/yêu cầu cụ thể
- **Nhóm** (Presale/Postsale, tùy chọn), **Ưu tiên**, **Thời hạn hoàn thành** (dd/mm/yyyy)
- **Nguồn việc**: *Nội bộ* hoặc *Khách hàng* (chọn Khách hàng sẽ hiện ô Tên khách & Liên hệ khách)
- **Giao cho**: tích chọn nhiều người; với mỗi người được chọn có thể đặt **★ Nhóm trưởng**
  (chỉ một người là nhóm trưởng — người này được quyền đổi trạng thái việc)
- **Tài liệu đính kèm**: chọn tệp (đính kèm khi lưu)

**Nhân viên thường**: form rút gọn — chỉ tạo được **việc khách hàng**, hệ thống tự gán bạn là
người nhận kiêm nhóm trưởng. Nếu không tự xử lý được, hãy dùng **Đẩy cấp trên** sau khi tạo.

### 3.3 Sửa / Xóa việc

Chỉ người quản lý thấy nút **Sửa** / **Xóa** trên mỗi dòng (và nút "Sửa công việc" trong khung
chi tiết). Xóa việc sẽ xóa kèm phân công, đính kèm, vấn đề của việc đó.

### 3.4 Đổi trạng thái

Cột **Trạng thái** là ô chọn nếu bạn có quyền đổi — gồm: *Chờ xử lý · Đang thực hiện ·
Hoàn thành · Hủy*. Được đổi trạng thái khi bạn là **người quản lý** hoặc **nhóm trưởng của
việc đó**. Người khác chỉ thấy nhãn tĩnh.

---

## 4. Khung chi tiết công việc

Mở bằng cách bấm tên việc. Hiển thị: trạng thái, ưu tiên, nhóm, nguồn việc, hạn, người tạo,
mô tả, chỉ đạo, danh sách người nhận (★ nhóm trưởng + trạng thái nhận), tài liệu, vấn đề.

Tùy vai trò và quan hệ với việc, bạn sẽ thấy các nút thao tác:

### 4.1 Chấp nhận / Từ chối (khi được chuyển việc)
Khi ai đó **chuyển việc** cho bạn, việc ở trạng thái chờ. Mở chi tiết sẽ thấy:
**📥 Bạn được chuyển việc này** → bấm **Chấp nhận** hoặc **Từ chối**.

### 4.2 Chuyển việc (Handoff)
Nếu bạn đang giữ việc (đã chấp nhận), bấm **↪ Chuyển việc** → chọn người nhận + ghi chú bàn
giao. Người nhận phải **chấp nhận** thì mới chính thức tiếp quản (trước đó việc ở trạng thái chờ
nhận với người đó).

### 4.3 Đẩy cấp trên (Escalation)
Khi vướng mắc không tự xử lý được, bấm **⬆ Đẩy cấp trên** → ghi lý do/vướng mắc. Việc sẽ gắn
cờ **Đã đẩy cấp trên** để Trưởng/Phó phòng chú ý. Khi đã xử lý xong, **người quản lý** bấm
**✓ Đã xử lý (gỡ cờ đẩy)**.

### 4.4 Tài liệu đính kèm
Người quản lý hoặc người đang được giao việc có thể **+ Thêm tệp**. Người tải lên (hoặc người
quản lý) có thể xóa tệp của mình. Bấm tên tệp để mở/tải về.

### 4.5 Báo cáo vấn đề
Người đang được giao việc bấm **+ Báo vấn đề** → mô tả vướng mắc khi triển khai. Vấn đề hiển thị
trạng thái *Đang mở* / *Đã xử lý*. **Người quản lý** bấm **✓ Đã xử lý** để đóng vấn đề. Số vấn
đề đang mở hiển thị ở bảng việc (**⚠ N vấn đề**).

---

## 5. Nhật ký công việc

Mỗi người **tự ghi nhật ký hằng ngày** — đây là đầu vào để tính báo cáo năng lực.

- Chọn khoảng **Từ … Đến …** (mặc định từ đầu tháng đến hôm nay) để xem.
- Bấm **+ Ghi nhật ký**: chọn **Ngày**, **Công việc liên quan** (tùy chọn — có thể không gắn
  việc nào), **Mô tả công việc đã làm**, **Số giờ công** (vd 4.5).
- Bấm dòng nhật ký (hoặc nút **Sửa**) để sửa/xóa — chỉ sửa được nhật ký **của chính bạn**.
- Thanh trên hiển thị **Tổng giờ** trong khoảng đang xem.
- **Người quản lý** có thêm ô **Người** để xem nhật ký của thành viên khác (chỉ xem).

> Ghi nhật ký đều đặn mỗi ngày giúp báo cáo năng lực phản ánh đúng khối lượng công việc.

---

## 6. Báo cáo năng lực

Tổng hợp giờ công theo khoảng ngày. Mỗi thành viên một dòng:

| Cột | Ý nghĩa |
|-----|---------|
| **Tổng giờ** | Tổng số giờ công đã ghi trong nhật ký |
| **Ngày ghi** | Số ngày có ghi nhật ký |
| **Giờ TB/ngày** | Tổng giờ ÷ số ngày ghi |
| **Việc chạm** | Số công việc khác nhau có gắn trong nhật ký |
| **Hoàn thành** | Số việc đã hoàn thành |
| **% sử dụng** | Tổng giờ ÷ (số ngày công × 8 giờ) — màu: ≥90% cao, 50–89% trung bình, <50% thấp |

Thanh trên hiển thị **Số ngày công** trong khoảng (cơ sở để tính chuẩn 8 giờ/ngày).

- **Nhân viên** chỉ xem năng lực của chính mình.
- **Người quản lý** xem toàn phòng và lọc theo **Nhóm** (Presale/Postsale).

---

## 7. Vòng đời một công việc (tóm tắt)

```
Tạo việc ──► Giao cho người (kèm nhóm trưởng)
                  │
                  ├─ Người nhận: Chờ xử lý → Đang thực hiện → Hoàn thành
                  │
                  ├─ Gặp vướng:  Báo vấn đề   → người quản lý đánh dấu Đã xử lý
                  │              Đẩy cấp trên  → người quản lý gỡ cờ sau khi xử lý
                  │
                  └─ Bàn giao:   Chuyển việc → người mới Chấp nhận / Từ chối
```

Song song, mỗi người **ghi nhật ký** mỗi ngày → tổng hợp thành **báo cáo năng lực**.

---

## 8. Câu hỏi thường gặp

**Không thấy menu "Công việc → KT Cơ điện"?**
Tài khoản chưa thuộc Ban KT Cơ điện. Nhờ admin gán bạn vào phòng/đưa vào danh sách thành viên.

**Tôi là nhân viên, vì sao chỉ tạo được việc khách hàng?**
Việc nội bộ do Trưởng/Phó phòng tạo và phân công. Việc do khách hàng báo trực tiếp thì bạn tự
tạo, tự nhận; nếu kẹt thì Đẩy cấp trên.

**Vì sao tôi không đổi được trạng thái việc?**
Chỉ nhóm trưởng của việc (hoặc người quản lý) mới đổi trạng thái. Nếu bạn là người nhận thường,
hãy phối hợp với nhóm trưởng, hoặc báo vấn đề/đẩy cấp trên khi cần.

**Chuyển việc xong sao người kia chưa thấy nhận?**
Người nhận phải mở chi tiết việc và bấm **Chấp nhận**. Trước đó việc ở trạng thái "Chờ nhận"
với họ; họ cũng có thể **Từ chối**.
