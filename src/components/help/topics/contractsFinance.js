// Hướng dẫn Hợp đồng bán — phần 2: tiến độ theo biên bản, công nợ, hóa đơn,
// bảo hành, bảo lãnh, công việc triển khai. Phần 1 ở contractsCore.js.

export const CONTRACTS_FINANCE_PAGES = [
  {
    id: 'co-progress',
    title: 'Tab "Tiến độ theo biên bản"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Ghi nhận các BIÊN BẢN đã ký với khách hàng trong quá trình thực hiện: biên bản giao hàng, nghiệm thu, bàn giao đưa vào sử dụng, thanh lý...',
          'Mỗi dòng gồm: loại biên bản, số biên bản, ngày ký, ghi chú — thể hiện hợp đồng đã đi đến bước nào.',
          'Danh mục "loại biên bản" do quản trị viên khai báo ở menu Hệ thống; nếu thiếu loại cần dùng, báo quản trị viên thêm.',
        ],
      },
      {
        heading: 'Cách thêm biên bản',
        items: [
          'PM bấm nút thêm, chọn loại biên bản, nhập số và ngày ký, rồi lưu.',
          'Bản scan của biên bản nên tải lên tab "Tài liệu hợp đồng" để tra cứu sau này.',
        ],
      },
    ],
  },
  {
    id: 'co-debt',
    title: 'Tab "Công nợ" (kế hoạch thu tiền)',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Kế hoạch thu tiền của hợp đồng, chia thành các ĐỢT THU (ví dụ: tạm ứng 30%, sau giao hàng 40%, sau nghiệm thu 25%, giữ lại bảo hành 5%).',
          'Mỗi đợt: nội dung, số tiền, "% theo HĐ" (tỷ lệ trên tổng giá trị), hạn thu, và tiền ĐÃ THU gắn vào đợt đó.',
          'Ba con số tổng: PHẢI THU (theo kế hoạch) — ĐÃ THU (thực tế) — CÒN THIẾU.',
          'Mọi số tính theo đồng tiền của hợp đồng; cột "Quy đổi VNĐ" chỉ để tham khảo.',
        ],
      },
      {
        heading: 'Cách thao tác',
        items: [
          'PM/Kế toán thêm từng đợt thu: nhập nội dung, số tiền (hoặc %), hạn thu dự kiến.',
          'Khi khách chuyển tiền: ghi nhận khoản thu và GẮN vào đúng đợt — hệ thống tự cập nhật Đã thu/Còn thiếu.',
          'Đợt quá hạn thu mà chưa đủ tiền sẽ được tính vào "Nợ quá hạn" trên các báo cáo kế toán và cảnh báo.',
        ],
      },
    ],
  },
  {
    id: 'co-invoice',
    title: 'Tab "Quản lý hóa đơn"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Danh sách hóa đơn đã xuất cho hợp đồng: số hóa đơn, ngày xuất, giá trị, và xuất cho những dòng hàng nào.',
          'Hệ thống theo dõi từng dòng trong Bảng giá đã xuất hóa đơn bao nhiêu — tránh xuất trùng hoặc xuất sót.',
        ],
      },
      {
        heading: 'Cách xuất hóa đơn',
        items: [
          'Bấm nút thêm hóa đơn, nhập số hóa đơn và ngày xuất.',
          'Chọn các DÒNG HÀNG (từ bảng giá) đưa vào hóa đơn này kèm số lượng/giá trị xuất.',
          'Có thể sao chép một hóa đơn cũ để tạo hóa đơn mới tương tự rồi sửa lại cho nhanh.',
          'Hóa đơn xuất ở đây sẽ tự xuất hiện trong báo cáo "Xuất hóa đơn" của bảng điều khiển Kế toán.',
        ],
      },
      {
        heading: 'Đợt nháp và quy tắc "một nháp tại một thời điểm"',
        items: [
          'Một đợt chỉ được coi là ĐÃ XUẤT khi có ĐỦ cả Số hóa đơn VÀ Ngày xuất. Thiếu một trong hai thì đợt đó là NHÁP.',
          'Đợt nháp KHÔNG bị trừ vào "Đã xuất" và không tính vào công nợ/doanh thu — số lượng của nó vẫn nằm ở cột "Tồn chưa xuất".',
          'Khi còn một đợt nháp, nút "+ Thêm đợt xuất hóa đơn" bị khóa: hãy HOÀN THIỆN đợt nháp (điền đủ Số HĐ + Ngày xuất) hoặc XÓA nó trước khi tạo đợt mới. Việc này tránh cùng một mặt hàng bị đưa vào nhiều đợt nháp.',
        ],
      },
    ],
  },
  {
    id: 'co-warranty',
    title: 'Tab "Bảo hành"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Danh sách thiết bị bán ra kèm SERIAL và thời hạn bảo hành cho khách: serial nào, thuộc thiết bị nào, bảo hành đến ngày nào, còn hạn hay hết hạn.',
          'Đây là nguồn dữ liệu cho trang "Tra cứu bảo hành" — khách hỏi thì tra serial là ra.',
        ],
      },
      {
        heading: 'Cách thao tác',
        items: [
          'Nhập serial cho từng thiết bị (PM/Kỹ thuật của hợp đồng được nhập).',
          'Serial phải DUY NHẤT trong toàn bộ hợp đồng bán của hệ thống (không phân biệt hoa/thường) — trùng sẽ bị báo lỗi.',
          'Khi đổi máy cho khách (thay thiết bị hỏng): dùng chức năng THAY THẾ SERIAL — serial cũ được ghi lại là "đã thay bằng serial mới", tra cứu vẫn thấy lịch sử.',
        ],
      },
    ],
  },
  {
    id: 'co-guarantee',
    title: 'Tab "Bảo lãnh"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Theo dõi các thư BẢO LÃNH NGÂN HÀNG của hợp đồng: bảo lãnh thực hiện hợp đồng, bảo lãnh tạm ứng, bảo lãnh bảo hành...',
          'Mỗi dòng: loại bảo lãnh, ngân hàng phát hành, số tiền, ngày phát hành, ngày HẾT HẠN.',
          'Theo dõi ngày hết hạn để kịp gia hạn hoặc lấy lại bảo lãnh — tránh bị ngân hàng tự động gia hạn tốn phí.',
        ],
      },
      {
        heading: 'Cách thao tác',
        items: [
          'PM/Kế toán bấm thêm, nhập thông tin thư bảo lãnh rồi lưu; hết hiệu lực thì cập nhật trạng thái.',
        ],
      },
    ],
  },
  {
    id: 'co-tasks',
    title: 'Tab "Công việc triển khai"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Danh sách công việc để thực hiện hợp đồng: tên việc, người thực hiện, ngày bắt đầu/kết thúc, trạng thái (Chờ → Đang thực hiện → Hoàn thành).',
          'Việc có thể có VIỆC CON nhiều cấp (bấm mũi tên đầu dòng để mở/đóng cây việc). Việc cha tự hoàn thành khi mọi việc con xong, và tự mở lại nếu một việc con mở lại.',
          'Biểu đồ GANTT thể hiện các việc trên trục thời gian — nhìn là biết việc nào nối tiếp việc nào, việc nào đang trễ.',
        ],
      },
      {
        heading: 'Giao việc và thực hiện',
        items: [
          'PM bấm thêm việc: đặt tên, chọn người thực hiện, ngày bắt đầu/hạn hoàn thành; có thể đặt việc này bắt đầu SAU KHI việc khác xong.',
          'Việc tự chuyển "Chờ" → "Đang thực hiện" khi tới ngày bắt đầu hoặc khi bước trước hoàn thành; người thực hiện nhận thông báo Telegram.',
          'Người được giao việc cũng được tạo VIỆC CON bên trong việc của mình để tự chia nhỏ.',
          '"Chuyển việc" đổi người thực hiện; mọi lần chuyển được ghi nhật ký — di chuột vào tên người thực hiện để xem lịch sử chuyển.',
        ],
      },
      {
        heading: 'Trao đổi trong việc',
        items: [
          'Bấm vào một việc để mở ngăn chi tiết bên phải: có dòng thời gian TRAO ĐỔI — gõ nội dung báo cáo tiến độ, vướng mắc, đính kèm tệp.',
          'Việc có trao đổi mới bạn chưa đọc sẽ tô NỀN HỔ PHÁCH trên các bảng theo dõi (kể cả trang chủ).',
        ],
      },
      {
        heading: 'Sắp xếp trên Gantt',
        items: [
          'Chuyển Gantt sang chế độ "Không nhóm" để KÉO THẢ các dòng, sắp xếp thứ tự hiển thị theo ý muốn; thứ tự này được lưu lại cho mọi người.',
        ],
      },
    ],
  },
]
