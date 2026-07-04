// Nhóm hướng dẫn: menu Hệ thống (quản trị) — từng mục con một trang.

export const ADMIN_GROUP = {
  id: 'admin',
  icon: '⚙️',
  title: 'Hệ thống (quản trị)',
  perm: 'module.system.view',
  pages: [
    {
      id: 'ad-users',
      title: 'Quản lý người dùng',
      sections: [
        {
          heading: 'Màn hình thể hiện gì & cách dùng',
          items: [
            'Danh sách tài khoản: họ tên, email, phòng ban, chức danh, vai trò (quản trị hay thường).',
            'Thêm người mới: bấm thêm, nhập họ tên + email + mật khẩu ban đầu, gán phòng ban và chức danh.',
            'Sửa nhanh: NHẤN ĐÚP (double click) vào một dòng để mở ngay cửa sổ sửa người đó — không cần bấm nút "Sửa".',
            'Một người có thể giữ NHIỀU chức danh cùng lúc (ví dụ vừa Trưởng phòng vừa PM).',
            'Một người có thể thuộc NHIỀU ban: chọn "Phòng ban" là phòng CHÍNH, rồi tích thêm ở ô "Ban kiêm nhiệm" nếu người đó còn thuộc ban khác. Trong danh sách người dùng, cột "Phòng ban" hiện phòng chính kèm chú thích "+ kiêm nhiệm ...".',
            'Ban kiêm nhiệm CHỈ dùng để CẤP QUYỀN: người đó nhận thêm quyền của ban kia; nếu là Trưởng/Phó ban thì kế thừa quyền thành viên của cả các ban đó. Riêng các module theo phòng (Công việc phòng, Dashboard phòng, Đấu thầu) vẫn tính theo phòng CHÍNH.',
            'Muốn người dùng nhận thông báo Telegram: điền mã Telegram (chat id) vào hồ sơ của họ.',
          ],
        },
      ],
    },
    {
      id: 'ad-catalog',
      title: 'Danh mục: Phòng ban, Chức danh, Khách hàng, Nhà cung cấp, Loại biên bản',
      sections: [
        {
          heading: 'Các mục danh mục dùng chung',
          items: [
            '"Quản lý phòng ban" / "Chức danh": khai báo cơ cấu tổ chức — là căn cứ để phân quyền theo vị trí và phòng ban.',
            '"Quản lý khách hàng": danh bạ chủ đầu tư/khách hàng — nơi các hợp đồng bán và gói thầu chọn ra.',
            '"Quản lý nhà cung cấp": danh bạ NCC — nơi hợp đồng nhập chọn ra.',
            '"Loại biên bản": các loại biên bản (giao hàng, nghiệm thu...) dùng ở tab "Tiến độ theo biên bản" của hợp đồng.',
            'Quy tắc chung: khai danh mục MỘT LẦN ở đây, mọi nơi khác chỉ chọn từ danh sách — không gõ tay để tránh trùng lặp sai chính tả.',
            'Sửa nhanh: ở mọi bảng danh mục, NHẤN ĐÚP (double click) vào một dòng để mở ngay cửa sổ sửa dòng đó — không cần bấm nút "Sửa".',
          ],
        },
      ],
    },
    {
      id: 'ad-permissions',
      title: 'Phân quyền',
      sections: [
        {
          heading: 'Mô hình 2 lớp',
          items: [
            'Lớp A — theo CHỨC DANH hoặc PHÒNG BAN: quyết định ai VÀO ĐƯỢC phân hệ nào (menu nào hiện ra) và các quyền chung.',
            'Lớp B — theo VAI TRÒ THÀNH VIÊN trong từng hồ sơ: trong một hợp đồng cụ thể, ai xem/sửa được tab nào (PM chính sửa tất cả, Kế toán xem công nợ...).',
            'Trưởng phòng/Phó phòng tự KẾ THỪA quyền xem dữ liệu của phòng mình, không cần cấp tay.',
          ],
        },
        {
          heading: 'Cách cấp quyền',
          items: [
            'Mở mục "Phân quyền", chọn chức danh (hoặc phòng ban), tích các quyền muốn cấp rồi lưu — mọi người giữ chức danh đó nhận quyền ngay.',
            'Người dùng báo "không thấy menu X": vào đây kiểm tra chức danh của họ đã được tích quyền xem phân hệ X chưa.',
            'Quyền xem BẢNG ĐIỀU KHIỂN trang chủ (Kế toán, Việc của phòng...) cũng cấp tại đây.',
          ],
        },
      ],
    },
    {
      id: 'ad-audit',
      title: 'Nhật ký thay đổi',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Ghi lại MỌI thao tác thêm/sửa/xóa trên hợp đồng bán và hợp đồng nhập, chi tiết đến từng trường: giá trị CŨ → giá trị MỚI, ai làm, lúc nào.',
            'Dùng khi cần truy vết: "ai đã sửa đơn giá dòng này?", "số tiền này bị đổi khi nào?".',
            'Trang chỉ xem — lọc theo thời gian, người thao tác, bảng dữ liệu để thu hẹp kết quả.',
          ],
        },
      ],
    },
    {
      id: 'ad-feedback-tg',
      title: 'Xử lý Góp ý & Nhật ký Telegram',
      sections: [
        {
          heading: 'Góp ý',
          items: [
            'Mục "Góp ý" phía quản trị: xem toàn bộ góp ý người dùng gửi (kèm ảnh), đổi trạng thái xử lý và viết phản hồi — người gửi sẽ thấy phản hồi của bạn.',
          ],
        },
        {
          heading: 'Nhật ký Telegram',
          items: [
            'Liệt kê các tin nhắn Telegram hệ thống đã gửi (giao việc, nhắc duyệt...) và kết quả gửi.',
            'Người dùng báo "không nhận được thông báo": tra ở đây xem tin có được gửi không, lỗi gì (thường do chưa điền chat id).',
          ],
        },
      ],
    },
    {
      id: 'ad-backup',
      title: 'Sao lưu / Khôi phục',
      sections: [
        {
          heading: 'Hai phần riêng biệt',
          items: [
            'Phần 1 — CƠ SỞ DỮ LIỆU: bấm sao lưu để tải file nén về máy; khôi phục bằng cách tải file đó lên lại. Nên sao lưu định kỳ và trước khi nâng cấp.',
            'Phần 2 — KHO TỆP ĐÍNH KÈM (dung lượng rất lớn, hàng chục GB): bấm tạo gói trên máy chủ (chạy nền, chờ xong), rồi tải về qua link riêng (hỗ trợ tải tiếp khi đứt mạng); khôi phục từ file gói đã chép sẵn lên máy chủ.',
            'Lưu file sao lưu ở nơi an toàn ngoài máy chủ (ổ cứng rời, máy khác).',
          ],
        },
      ],
    },
    {
      id: 'ad-diagnostics',
      title: 'Chẩn đoán hiệu năng',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Trang CHỈ XEM dành cho kỹ thuật: thống kê các đường API được gọi nhiều/chậm và các câu truy vấn nặng của cơ sở dữ liệu.',
            'Dòng gắn cờ 🔴 = đường vừa nóng (gọi nhiều) vừa chậm mà chưa được cache — gợi ý chỗ nên tối ưu.',
            'Trang không tự thay đổi gì hệ thống; chỉ là công cụ chẩn đoán.',
          ],
        },
        {
          heading: 'Thẻ "Hệ thống CSDL PostgreSQL" — đọc các con số',
          items: [
            'Phiên bản, Kích thước DB: thông tin cơ bản của cơ sở dữ liệu.',
            'Kết nối: "X chạy · Y tổng / Z (%)" — X là số phiên đang chạy lệnh, Y là tổng số phiên đang mở tới DB, Z là giới hạn tối đa (max_connections) và % là Y so với Z. Con số chuyển màu vàng khi vượt 80% và ĐỎ khi vượt 90% — lúc đó cần chú ý vì hết slot kết nối sẽ khiến ứng dụng không vào được DB.',
            'Lưu ý: "tổng" đếm MỌI phiên nối tới DB (kể cả psql hay tiến trình khác), còn "Pool ứng dụng" bên dưới chỉ đếm riêng kết nối của máy chủ ứng dụng — nên hai số có thể bằng nhau khi ứng dụng là client duy nhất.',
            'Đỉnh kết nối (7 ngày): giá trị "tổng" CAO NHẤT quan sát được trong 7 ngày gần nhất và thời điểm xảy ra. Hệ thống tự lấy mẫu ngầm mỗi phút (kể cả khi không ai mở màn hình này), nên đây mới là con số dự báo nguy cơ "sắp hết kết nối" — cùng quy tắc màu vàng ≥80%, đỏ ≥90%. Mốc này được giữ trong bộ nhớ và sẽ đặt lại khi máy chủ khởi động lại (ví dụ sau khi cập nhật phần mềm).',
            'Idle in transaction: số phiên đã mở một giao dịch nhưng đang "treo" không làm gì. Bình thường phải là 0 (màu xanh); nếu > 0 kéo dài (màu vàng) là dấu hiệu giao dịch bị rò rỉ — nó giữ khóa và cản dọn dẹp tự động, là nguyên nhân nghẽn phổ biến.',
            'Tỷ lệ hit cache: phần trăm dữ liệu được đọc từ bộ nhớ đệm thay vì đọc đĩa. Cao là tốt: xanh khi ≥ 99%, vàng ≥ 95%, đỏ dưới đó (đọc đĩa nhiều = chậm, thường do thiếu RAM). "—" nghĩa là DB chưa có đủ lượt truy vấn để tính.',
            'Pool ứng dụng: số kết nối do máy chủ ứng dụng đang giữ (mở / rảnh / chờ).',
          ],
        },
        {
          heading: 'Thẻ "Đĩa" — dung lượng và phân rã',
          items: [
            'Thanh trên cùng cho biết đã dùng bao nhiêu trên tổng dung lượng đĩa và còn trống bao nhiêu; đổi màu xanh/vàng/đỏ theo mức dùng (vàng ≥ 70%, đỏ ≥ 90%).',
            'Phần "Phân rã dung lượng" tách phần đã dùng thành: Tệp đính kèm (thư mục uploads — tài liệu, ảnh người dùng tải lên), Bản sao lưu (các tệp .tar do module Sao lưu/Khôi phục tạo ra, rất dễ phình to), Cơ sở dữ liệu (kích thước PostgreSQL) và Khác/hệ thống (hệ điều hành, log, phần còn lại). "Trống" là chỗ còn lại tới tổng.',
            'Dùng phần này để biết CHỖ NÀO đang ăn đĩa khi sắp đầy — ví dụ nếu "Bản sao lưu" chiếm quá nhiều thì nên xóa bớt bản .tar cũ trong module Sao lưu/Khôi phục.',
            'Hai số uploads và bản sao lưu được đo ngầm khoảng 10 phút/lần (quét cả thư mục lớn khá tốn kém nên không đo liên tục); dòng cuối ghi thời điểm đo gần nhất. Lần đầu mới mở có thể hiện "Đang đo…" một lúc.',
          ],
        },
        {
          heading: 'Thẻ "Tiến trình ứng dụng" — đọc các con số',
          items: [
            'Node, Môi trường, Uptime tiến trình: phiên bản Node, chế độ chạy (development/production) và thời gian tiến trình đã chạy.',
            'RSS, Heap: lượng RAM tiến trình đang chiếm và phần bộ nhớ đối tượng của Node.',
            'Trễ vòng lặp: mức "kẹt" của vòng lặp sự kiện Node, hiển thị p99 (99% số lần dưới mức này) và đỉnh, tính bằng mili-giây. Đây là chỉ số sức khỏe quan trọng nhất của tiến trình: Node xử lý một luồng, nếu một tác vụ nặng làm vòng lặp trễ thì MỌI yêu cầu đều chậm theo. Xanh khi < 50ms, vàng 50–200ms, ĐỎ ≥ 200ms.',
            'CPU tiến trình: phần trăm CPU (theo một nhân) mà RIÊNG tiến trình ứng dụng đang dùng — khác với CPU toàn máy ở thẻ "Phần cứng". Xanh < 70%, vàng 70–90%, đỏ ≥ 90%. Cao kéo dài nghĩa là app đang bị nghẽn tính toán.',
          ],
        },
        {
          heading: 'Xóa cache',
          items: [
            'Tại thẻ "Hệ thống Cache" (tab Tổng quan hệ thống) có nút 🗑️ Xóa cache. Bấm để xóa sạch toàn bộ cache Redis khi cần buộc mọi màn hình nạp lại số liệu mới nhất từ cơ sở dữ liệu.',
            'Đây là thao tác nhạy cảm nên hệ thống yêu cầu nhập lại MẬT KHẨU của bạn để xác nhận. Nhập sai mật khẩu sẽ không xóa.',
            'Sau khi xóa xong, ô "Số key" và "Tỷ lệ hit" đều về 0 (bộ đếm hit/miss cũng được đặt lại để đo lại từ đầu), và các trang có thể chậm hơn một chút ở lần tải đầu (vì phải đọc lại từ DB rồi cache lại). Nút chỉ hiện khi cache đang bật.',
          ],
        },
      ],
    },
  ],
}
