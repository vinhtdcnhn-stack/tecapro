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
            'Việc nào có nhãn vàng ⏳ "chờ duyệt" nghĩa là người thực hiện ĐÃ BÁO HOÀN THÀNH nhưng chưa ai xác nhận — dòng ngay dưới ghi rõ ai báo và báo ngày nào. Việc vẫn nằm lại bảng cho tới khi được duyệt; bấm vào dòng để mở việc rồi bấm ✔ (xác nhận xong) hoặc ✘ (chưa đạt, phải nhập lý do).',
            'Mốc CÔNG NỢ chỉ hiện khi khoản đó CÒN THIẾU TIỀN — cả phải thu (hợp đồng bán) lẫn phải trả nhà cung cấp (hợp đồng nhập). Trả/thu đủ một đợt là đợt đó tự biến mất khỏi bảng, dòng phụ ghi rõ số còn lại. Nếu một khoản đã trả đủ mà vẫn thấy báo quá hạn, kiểm tra xem đợt thanh toán đã được gắn vào đúng khoản phải trả chưa (tab Thanh toán của hợp đồng nhập).',
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
          heading: 'Bấm vào ô số để xem chi tiết',
          items: [
            'Bấm vào một ô số bất kỳ, màn hình chi tiết của ô đó sẽ bung ra.',
            'Riêng ô "Tổng giá trị hợp đồng": phía trên là các thẻ gom theo trạng thái hợp đồng, phía dưới là bảng danh sách hợp đồng gồm các cột: STT, Số HĐ, Ngày ký, CĐT (chủ đầu tư), Giá trị trước VAT, Giá trị sau VAT, Dự án, PM (người quản lý dự án).',
            'Hai cột giá trị hiển thị số đã QUY ĐỔI VNĐ; nếu hợp đồng ký bằng ngoại tệ, đưa chuột vào ô tiền sẽ hiện thêm số nguyên tệ (ví dụ USD).',
            'Bảng xếp theo giá trị sau VAT từ cao xuống thấp. Bấm vào một dòng để mở thẳng hợp đồng đó.',
            'Bảng chia trang 15 hợp đồng/trang: dùng nút "‹ Trước", "Sau ›" hoặc bấm thẳng vào số trang ở dưới bảng. Dòng chữ bên trái cho biết đang xem từ dòng nào đến dòng nào trong tổng số.',
            'Nếu màn hình hẹp, kéo thanh cuộn ngang dưới bảng để xem các cột bên phải — 2 cột "STT" và "Số HĐ" luôn đứng yên bên trái để bạn biết đang xem hợp đồng nào.',
            'Bấm chuột phải (hoặc ấn giữ trên điện thoại) vào một dòng để "Sao chép thông tin" dán vào chat.',
          ],
        },
        {
          heading: 'Bộ lọc thời gian',
          items: [
            'Nút 📅 bên phải lọc theo KHOẢNG NGÀY KÝ hợp đồng: bấm vào rồi nhập "Từ ngày" và "Đến ngày" theo dạng dd/mm/yyyy (hoặc bấm nút 📅 nhỏ trong ô để chọn trên lịch). Số liệu chỉ tính các hợp đồng ký trong khoảng đó.',
            'Bên dưới 2 ô ngày có các nút bấm nhanh: "Tháng này", "Quý này", "Từ đầu năm", "Năm 2026", "Năm 2025", "Toàn bộ" (bỏ giới hạn thời gian) — bấm 1 cái là điền sẵn khoảng ngày tương ứng.',
            'Có thể để trống một đầu: chỉ điền "Từ ngày" = tính từ ngày đó tới nay; chỉ điền "Đến ngày" = tính tất cả cho tới ngày đó. Nút "Mặc định (3 năm gần nhất)" đưa về khoảng ban đầu.',
            'Khoảng thời gian bạn chọn được nhớ cho lần sau (kể cả khi tải lại trang).',
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
            'Nhãn vàng ⏳ "chờ duyệt" = nhân sự đã báo làm xong, đang chờ người giao việc (hoặc trưởng/phó phòng) xác nhận. Dòng dưới ghi ai báo, ngày nào. Bấm vào dòng để mở việc và bấm ✔ xác nhận, hoặc ✘ trả lại kèm lý do — chỉ khi được duyệt việc mới rời khỏi bảng.',
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
            'Việc bạn đã báo hoàn thành nhưng người giao chưa duyệt vẫn ở lại bảng, mang nhãn vàng ⏳ "chờ duyệt" — để bạn biết mà nhắc, và nếu bị trả lại thì việc quay về "Đang thực hiện".',
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
            'Bao gồm cả ba loại: công việc hợp đồng, việc của phòng và đầu việc đấu thầu — đúng với các việc đang làm nền toàn trang chuyển đỏ nhấp nháy cảnh báo.',
            'Bấm vào từng dòng để đọc; đọc xong dòng sẽ tự rời khỏi danh sách.',
            'Dòng có nhãn vàng ⏳ "chờ duyệt" là việc đã được báo hoàn thành nhưng chưa ai xác nhận — thường kèm trao đổi mới cần bạn xem rồi chốt.',
            'Danh sách trống nghĩa là bạn đã đọc hết — không còn gì tồn đọng.',
          ],
        },
      ],
    },
  ],
}
