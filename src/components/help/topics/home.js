// Nhóm hướng dẫn: Trang chủ — các bảng điều khiển (dashboard).
// Bảng điều khiển "Kế toán" được tách thành nhóm riêng (accounting.js) vì có 8 tab con.

export const HOME_GROUP = {
  id: 'home',
  icon: '🏠',
  title: 'Trang chủ — bảng điều khiển',
  pages: [
    {
      id: 'home-switch',
      title: 'Chọn / đổi bảng điều khiển',
      sections: [
        {
          heading: 'Bảng điều khiển là gì?',
          items: [
            'Trang chủ hiển thị một "bảng điều khiển" — màn hình tổng hợp số liệu và việc cần làm, phù hợp với vai trò của bạn.',
            'Mỗi người được cấp một hoặc nhiều bảng: Tiến độ dự án (cho PM), Tổng quan hệ thống (ban lãnh đạo), Kế toán, Kế hoạch đấu thầu, Việc của phòng, Việc của tôi, Chưa đọc.',
          ],
        },
        {
          heading: 'Cách đổi bảng',
          items: [
            'Ngay trên trang chủ có nút đổi bảng (cạnh dòng chào) — bấm vào sẽ xổ danh sách các bảng bạn được cấp, chọn bảng muốn xem.',
            'Hệ thống nhớ lựa chọn của bạn: lần sau mở trang chủ sẽ vào thẳng bảng đã chọn.',
            'Nếu danh sách chỉ có 1 bảng hoặc thiếu bảng bạn cần, liên hệ quản trị viên để được cấp thêm.',
          ],
        },
      ],
    },
    {
      id: 'home-pm',
      title: 'Bảng "Tiến độ dự án" (dành cho PM)',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Tiêu đề "Bảng theo dõi tiến độ dự án" — tổng hợp các MỐC THỜI HẠN (deadline) trong các hợp đồng bạn làm PM.',
            'Các ô số phía trên: "Mốc quá hạn" (màu đỏ — hạn đã qua mà chưa xong) và "Sắp đến hạn ≤7 ngày" (còn 0–7 ngày nữa là tới hạn).',
            'Bảng "Mốc thời hạn cần theo dõi" phía dưới liệt kê từng mốc: thuộc hợp đồng nào, việc gì, hạn ngày nào.',
          ],
        },
        {
          heading: 'Cách dùng',
          items: [
            'Bấm vào một Ô SỐ phía trên để lọc bảng bên dưới theo đúng nhóm đó (ví dụ bấm "Mốc quá hạn" chỉ hiện việc quá hạn).',
            'Bấm vào một dòng để mở thẳng hợp đồng/công việc tương ứng và xử lý.',
            'Mục tiêu mỗi ngày: đưa số "Mốc quá hạn" về 0.',
          ],
        },
      ],
    },
    {
      id: 'home-director',
      title: 'Bảng "Tổng quan hệ thống" (ban lãnh đạo)',
      sections: [
        {
          heading: 'Các ô số thể hiện gì?',
          items: [
            '"Tổng giá trị hợp đồng": tổng giá trị các hợp đồng bán trong phạm vi lọc.',
            '"Doanh thu đã thu": số tiền thực tế đã thu về.',
            '"Công nợ phải thu": số tiền khách còn nợ theo kế hoạch thu.',
            '"Nợ quá hạn": phần công nợ đã quá hạn thu — cần đôn đốc.',
            '"Công việc quá hạn": số việc triển khai trễ hạn trên toàn hệ thống.',
            'Khối đấu thầu: "Gói đang theo dõi", "Tỷ lệ trúng thầu", "Giá trị trúng thầu", "Gói sắp đến hạn nộp".',
          ],
        },
        {
          heading: 'Bộ lọc thời gian',
          items: [
            'Lọc theo KHOẢNG NĂM KÝ hợp đồng (ví dụ 2024–2026): số liệu chỉ tính các hợp đồng ký trong khoảng đó. Lựa chọn này được nhớ cho lần sau.',
            '"Xem tại thời điểm" (as-of): chọn một ngày trong quá khứ để xem số liệu tính đến ngày đó — dùng để so sánh trước/sau. Lựa chọn này KHÔNG lưu, tải lại trang sẽ về hiện tại.',
          ],
        },
      ],
    },
    {
      id: 'home-tender-dash',
      title: 'Bảng "Kế hoạch đấu thầu"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Tổng hợp các gói thầu đang theo dõi, phân theo trạng thái công việc: "Đang thực hiện", "Chờ review", "Chờ sửa", "Sẵn sàng in/ký".',
            'Giúp trưởng ban và thành viên biết gói nào đang vướng ở khâu nào, gói nào sắp đến hạn nộp hồ sơ.',
            'Bấm vào một gói để mở trang chi tiết gói thầu (xem nhóm hướng dẫn "Kế hoạch đấu thầu").',
          ],
        },
      ],
    },
    {
      id: 'home-dept',
      title: 'Bảng "Việc của phòng"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Danh sách công việc của phòng bạn (từ các hợp đồng và việc nội bộ), kèm người thực hiện và hạn hoàn thành.',
            'Dòng có NỀN VÀNG HỔ PHÁCH nghĩa là việc đó có trao đổi/nội dung MỚI bạn chưa đọc — bấm vào để xem, đọc xong nền sẽ trở lại bình thường.',
            'Cột hạn: "Đến hạn hôm nay" và số ngày quá hạn giúp ưu tiên việc cần làm trước.',
          ],
        },
      ],
    },
    {
      id: 'home-assignee',
      title: 'Bảng "Việc của tôi"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Chỉ liệt kê các việc GIAO CHO CHÍNH BẠN, gom từ mọi nguồn (hợp đồng, phòng ban...).',
            'Mỗi dòng: tên việc, thuộc hợp đồng/mảng nào, trạng thái, hạn hoàn thành.',
            'Dòng nền hổ phách = có trao đổi mới chưa đọc. Bấm vào dòng để mở việc, xem chi tiết và trả lời trao đổi.',
            'Nên mở bảng này mỗi sáng để biết hôm nay cần làm gì.',
          ],
        },
      ],
    },
    {
      id: 'home-unread',
      title: 'Bảng "Chưa đọc"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Gom về MỘT CHỖ tất cả các việc có nội dung trao đổi bạn chưa đọc, để không bỏ sót thông tin.',
            'Bấm vào từng dòng để đọc; đọc xong dòng sẽ tự rời khỏi danh sách.',
            'Danh sách trống nghĩa là bạn đã đọc hết — không còn gì tồn đọng.',
          ],
        },
      ],
    },
  ],
}
