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
            'Một người có thể giữ NHIỀU chức danh cùng lúc (ví dụ vừa Trưởng phòng vừa PM).',
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
      ],
    },
  ],
}
