// Nhóm hướng dẫn: Công việc phòng, Kế hoạch đấu thầu, Đề xuất & phê duyệt.

export const DEPTWORK_GROUP = {
  id: 'deptwork',
  icon: '🗂️',
  title: 'Công việc phòng',
  perm: 'module.deptwork.view',
  pages: [
    {
      id: 'dw-board',
      title: 'Mục "Bảng công việc"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Vào menu Công việc → "Dự án và chuyển giao công nghệ". Cột trái có 3 mục: Bảng công việc, Nhật ký công việc, Năng lực.',
            '"Bảng công việc" liệt kê các đầu việc của phòng: tên việc, người thực hiện, hạn, trạng thái.',
            'Bộ lọc trạng thái phía trên: Tất cả / Chờ xử lý / Đang thực hiện / Hoàn thành — bấm để lọc nhanh.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Trưởng phòng/Phó phòng thêm việc và giao cho thành viên; thành viên cập nhật trạng thái việc của mình.',
            'Bấm vào một việc để mở ngăn chi tiết: trao đổi theo dòng thời gian, đính kèm tệp, xem lịch sử.',
            'Việc có trao đổi mới chưa đọc tô nền hổ phách — đọc xong nền trở lại bình thường.',
          ],
        },
      ],
    },
    {
      id: 'dw-logs',
      title: 'Mục "Nhật ký công việc"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Nhật ký hàng ngày của phòng, chia theo khung giờ: Đêm hôm trước / Sáng / Chiều / Buổi tối.',
            'Mỗi ghi chép có phân loại: Báo cáo, Chỉ đạo, Quyết định, Trao đổi — để sau này lọc tìm lại.',
          ],
        },
        {
          heading: 'Cách ghi nhật ký',
          items: [
            'Chọn ngày, bấm thêm vào khung giờ tương ứng, chọn phân loại rồi gõ nội dung.',
            'Xem lại ngày cũ bằng cách đổi ngày ở bộ chọn phía trên.',
          ],
        },
      ],
    },
    {
      id: 'dw-capacity',
      title: 'Mục "Năng lực"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Bảng tổng hợp KHỐI LƯỢNG VIỆC theo từng người trong phòng: ai đang cầm bao nhiêu việc, tình trạng ra sao.',
            'Trưởng phòng dùng để cân đối — thấy ai quá tải thì san việc, ai trống thì giao thêm.',
          ],
        },
      ],
    },
  ],
}

export const TENDER_GROUP = {
  id: 'tender',
  icon: '📑',
  title: 'Kế hoạch đấu thầu',
  perm: 'module.tender.view',
  pages: [
    {
      id: 'td-list',
      title: 'Danh sách gói thầu',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Vào menu Công việc → "Kế hoạch đấu thầu": bảng các gói thầu đang theo dõi — tên gói, chủ đầu tư, hạn nộp hồ sơ, trạng thái.',
            'Bấm một gói để mở trang chi tiết với các tab: Thông tin chung, Hồ sơ mời thầu, Checklist công việc, Review & Comment, Lịch sử, Kết quả dự thầu.',
          ],
        },
        {
          heading: 'Thêm gói thầu',
          items: [
            'Bấm nút thêm gói, nhập tên gói, chọn CHỦ ĐẦU TƯ từ danh mục khách hàng, hạn nộp thầu... rồi lưu.',
          ],
        },
      ],
    },
    {
      id: 'td-info',
      title: 'Tab "Thông tin chung"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Thông tin gói: chủ đầu tư, hạn nộp, hình thức, và DỰ TOÁN (hỗ trợ nhiều loại tiền tệ).',
            'Gói lớn có thể chia thành nhiều LÔ — dự toán và kết quả dự thầu theo dõi riêng từng lô.',
          ],
        },
      ],
    },
    {
      id: 'td-invitation',
      title: 'Tab "Hồ sơ mời thầu"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Nơi lưu các tài liệu ĐẦU VÀO của gói: hồ sơ mời thầu, bản vẽ, phụ lục do chủ đầu tư phát hành.',
            'Tải tệp lên để cả nhóm cùng tra cứu khi làm hồ sơ dự thầu.',
          ],
        },
      ],
    },
    {
      id: 'td-checklist',
      title: 'Tab "Checklist công việc"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Danh sách các ĐẦU VIỆC phải hoàn thành để nộp được hồ sơ dự thầu (đơn dự thầu, bảo lãnh, hồ sơ năng lực, phương án kỹ thuật...), mỗi đầu việc có người được giao và trạng thái.',
            'Trạng thái mỗi đầu việc: Đang thực hiện → Chờ review → Chờ sửa (nếu bị yêu cầu làm lại) → Sẵn sàng in/ký.',
          ],
        },
        {
          heading: 'Cách dùng',
          items: [
            'Bấm "Áp dụng mẫu" để sinh nhanh danh sách đầu việc từ MẪU CHECKLIST dùng chung (mẫu do trưởng ban soạn, dùng lại cho mọi gói).',
            'Giao từng đầu việc cho thành viên; người được giao vào trang việc của mình để nộp tệp sản phẩm (hỗ trợ cả thư mục).',
            'Người được giao mở gói từ trang riêng có 2 tab: tài liệu gói (để đọc) và chỗ nộp sản phẩm của mình.',
            'Bấm vào TÊN đầu việc để mở ngăn chi tiết bên phải: thông tin tóm tắt + DÒNG THỜI GIAN trao đổi (báo cáo · chỉ đạo · quyết định · trao đổi), dán được ảnh trực tiếp bằng Ctrl+V (trên điện thoại có nút 📷 chụp ảnh thẳng từ camera). Mục MỚI NHẤT nằm trên cùng và ô "+ Thêm nội dung" ở ngay đầu — không phải cuộn xuống đáy. Người liên quan (người tạo, người được giao, người làm thầu, trưởng phòng) được báo Telegram khi có mục mới.',
          ],
        },
      ],
    },
    {
      id: 'td-review',
      title: 'Tab "Review & Comment"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Nơi người review kiểm tra TỪNG ĐẦU VIỆC đã nộp: xem tệp, viết nhận xét, duyệt hoặc yêu cầu làm lại.',
          ],
        },
        {
          heading: 'Quy trình duyệt',
          items: [
            'Yêu cầu làm lại phải kèm LÝ DO; hệ thống đếm số lần sửa của từng đầu việc.',
            'Khi có bản thay thế: bản gốc KHÔNG bị xóa — người duyệt đánh dấu bản nào bị loại/được thay, rồi gửi trưởng ban duyệt lần cuối.',
            'Đầu việc đạt sẽ chuyển "Sẵn sàng in/ký" — đủ hết là gói sẵn sàng nộp.',
          ],
        },
      ],
    },
    {
      id: 'td-activity',
      title: 'Tab "Lịch sử"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Dòng thời gian mọi hoạt động trên gói: ai giao việc, ai nộp bản mới, ai duyệt/yêu cầu sửa, lúc nào — chỉ xem, để đối chiếu khi cần.',
          ],
        },
      ],
    },
    {
      id: 'td-bidders',
      title: 'Tab "Kết quả dự thầu"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Sau khi mở thầu: nhập các NHÀ THẦU THAM DỰ và giá dự thầu của họ THEO TỪNG LÔ.',
            'Hệ thống tự XẾP HẠNG GIÁ từng lô — thấy ngay mình đứng thứ mấy, chênh bao nhiêu so với đối thủ.',
            'Ghi kết quả cuối cùng (trúng/trượt) để thống kê tỷ lệ trúng thầu trên bảng điều khiển.',
          ],
        },
      ],
    },
  ],
}

export const APPROVALS_GROUP = {
  id: 'approvals',
  icon: '✅',
  title: 'Đề xuất & phê duyệt',
  perm: 'module.approvals.view',
  pages: [
    {
      id: 'ap-my',
      title: 'Mục "Đơn của tôi" — gửi một đề xuất',
      sections: [
        {
          heading: 'Cách gửi đề xuất',
          items: [
            'Vào menu "Đề xuất" → mục "Đơn của tôi" → bấm nút tạo đơn.',
            'Chọn LOẠI ĐƠN (mua sắm, thanh toán, nghỉ phép... — tùy công ty cấu hình) và điền các trường của mẫu.',
            'Bấm GỬI để đơn vào luồng duyệt. Đơn lưu nháp thì chưa ai thấy — trạng thái "Nháp".',
            'Trạng thái đơn: Nháp → Chờ duyệt → Đã duyệt hoặc Từ chối; bạn cũng có thể tự hủy đơn ("Đã hủy").',
            'Bấm vào đơn để xem đang chờ ở bước nào, ai đã duyệt, ai đang cầm.',
          ],
        },
        {
          heading: 'Lưu ý về luồng duyệt',
          items: [
            'Mỗi loại đơn có sẵn các bước duyệt; bước có thể kèm điều kiện theo CHỨC DANH người gửi — bước không áp dụng với bạn sẽ tự bỏ qua.',
            'Người duyệt nhận thông báo Telegram và thấy badge 🔔 trên menu.',
          ],
        },
      ],
    },
    {
      id: 'ap-inbox',
      title: 'Mục "Chờ tôi duyệt" — xử lý đơn',
      sections: [
        {
          heading: 'Cách duyệt',
          items: [
            'Mục "Chờ tôi duyệt" liệt kê các đơn đang đợi CHÍNH BẠN quyết định (menu "Đề xuất" hiện 🔔 kèm số lượng).',
            'Bấm vào đơn, đọc nội dung và tệp đính kèm, rồi bấm Duyệt hoặc Từ chối (từ chối nên ghi lý do).',
            'Duyệt xong, đơn tự chuyển sang bước tiếp theo hoặc hoàn tất; người gửi được báo qua Telegram.',
          ],
        },
      ],
    },
    {
      id: 'ap-other',
      title: 'Mục "Sắp đến lượt tôi" & "Tôi theo dõi"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            '"Sắp đến lượt tôi": đơn đang ở bước trước bạn — chưa cần làm gì, nhưng biết trước sắp tới lượt mình.',
            '"Tôi theo dõi": các đơn bạn liên quan (được thêm là người theo dõi) — chỉ xem tiến trình, không phải duyệt.',
          ],
        },
      ],
    },
    {
      id: 'ap-admin',
      title: 'Quản trị: "Tất cả đề xuất" & "Loại đơn"',
      sections: [
        {
          heading: 'Dành cho quản trị viên',
          items: [
            '"Tất cả đề xuất": xem mọi đơn trong hệ thống, phục vụ tra soát.',
            '"Loại đơn": thiết kế mẫu đơn — thêm các trường (văn bản, số, số tiền, ngày, khoảng ngày, chọn một, có/không, nhân viên, tệp đính kèm, bảng nhiều dòng) và cấu hình các bước duyệt kèm điều kiện chức danh.',
          ],
        },
      ],
    },
  ],
}
