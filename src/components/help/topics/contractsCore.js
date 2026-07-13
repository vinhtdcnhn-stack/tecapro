// Hướng dẫn Hợp đồng bán — phần 1: danh sách, mở chi tiết, thông tin, tài liệu,
// bảng giá, theo dõi nhập hàng. Phần 2 (công nợ, hóa đơn...) ở contractsFinance.js.

export const CONTRACTS_CORE_PAGES = [
  {
    id: 'co-list',
    title: 'Danh sách hợp đồng bán',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Vào menu "Hợp đồng bán" — bảng liệt kê toàn bộ hợp đồng bạn được xem: số hợp đồng, tên dự án, chủ đầu tư, trạng thái, giá trị...',
          'Các cột GIÁ TRỊ TIỀN chỉ hiện với người được cấp quyền xem số tiền; không thấy cột tiền nghĩa là bạn chưa được cấp quyền đó.',
          'Trạng thái hợp đồng gồm: Chờ xử lý, Đang thực hiện, Hoàn thành, Hủy bỏ.',
        ],
      },
      {
        heading: 'Tìm và mở một hợp đồng',
        items: [
          'Gõ vào ô "🔍 Tìm kiếm (Số HĐ, Tên dự án, Chủ đầu tư...)" — bảng lọc ngay khi bạn gõ.',
          'Bấm vào dòng hợp đồng cần xem để mở trang chi tiết.',
        ],
      },
      {
        heading: 'Thêm hợp đồng mới',
        items: [
          'Bấm nút "Thêm hợp đồng" phía trên bảng.',
          'Điền các thông tin: số hợp đồng, tên dự án, chủ đầu tư (chọn từ danh mục khách hàng), ngày ký, loại tiền tệ...',
          'Lưu ý: GIÁ TRỊ hợp đồng (trước/sau VAT) KHÔNG nhập tay ở đây — hệ thống tự tính từ tab "Bảng giá" sau khi bạn nhập bảng giá.',
          'Bấm lưu — hợp đồng mới xuất hiện trong danh sách, bấm vào để bắt đầu nhập chi tiết.',
        ],
      },
      {
        heading: 'Tùy chỉnh cột hiển thị',
        items: [
          'Bấm nút "Cột" phía trên bảng để mở bảng chọn: tích/bỏ tích để hiện/ẩn từng cột.',
          'KÉO THẢ tiêu đề cột (giữ chuột vào tên cột rồi kéo sang trái/phải) để đổi thứ tự cột.',
          'Thiết lập lưu trên máy của bạn — người khác không bị ảnh hưởng.',
        ],
      },
    ],
  },
  {
    id: 'co-detail-nav',
    title: 'Trang chi tiết hợp đồng — cách di chuyển',
    sections: [
      {
        heading: 'Bố cục trang',
        items: [
          'Cột TRÁI là danh sách mục, chia 2 phần: "I. Hợp đồng bán" (Thông tin hợp đồng, Tài liệu hợp đồng, Bảng giá, Theo dõi nhập hàng, Tiến độ theo biên bản, Công nợ, Quản lý hóa đơn, Bảo hành, Bảo lãnh, Công việc triển khai) và "II. Hợp đồng nhập".',
          'Bấm mục nào thì phần bên phải hiện nội dung mục đó. Phím tắt Ctrl+↓ / Ctrl+↑ chuyển nhanh giữa các mục.',
          'Bạn chỉ thấy các mục mình có quyền xem trong hợp đồng này — danh sách mục của mỗi người có thể khác nhau.',
          'Rê chuột vào TÊN DỰ ÁN (dòng chữ lớn trên cùng) sẽ hiện bảng gợi ý nhân sự dự án: kinh doanh, PM chính, Presale, kỹ thuật, xuất nhập khẩu, kế toán, người theo dõi — xem nhanh mà không cần mở tab Thông tin hợp đồng. Nhóm nào chưa có người thì không hiện.',
        ],
      },
      {
        heading: 'Ai được sửa?',
        items: [
          'Chỉ PM CHÍNH của hợp đồng (và quản trị viên) được thêm/sửa/xóa dữ liệu; người khác chỉ xem.',
          'Nếu bạn là PM mà không thấy nút thêm/sửa, kiểm tra lại mình đã được gắn vai trò "PM chính" trong tab Thông tin hợp đồng chưa.',
        ],
      },
    ],
  },
  {
    id: 'co-info',
    title: 'Tab "Thông tin hợp đồng"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Thông tin gốc của hợp đồng: số HĐ, tên dự án, chủ đầu tư, ngày ký, trạng thái, loại tiền tệ, tỷ giá.',
          'Giá trị trước/sau VAT hiển thị ở đây là số TỰ TÍNH từ tab Bảng giá — muốn đổi giá trị phải sửa bảng giá, không sửa trực tiếp.',
          'Về tiền tệ: mọi số liệu của hợp đồng tính theo ĐỒNG TIỀN CỦA HỢP ĐỒNG (VND hoặc USD...). Tỷ giá chỉ để quy đổi THAM KHẢO sang VNĐ khi hiển thị.',
        ],
      },
      {
        heading: 'Thành viên hợp đồng',
        items: [
          'Bảng thành viên gắn từng người vào vai trò: Nhân viên kinh doanh, PM chính, Presale, Kỹ thuật triển khai, Xuất nhập khẩu, Kế toán, Người theo dõi.',
          'Vai trò quyết định quyền: PM chính được sửa mọi tab; Xuất nhập khẩu được tạo hợp đồng nhập; Kỹ thuật được nhập serial...',
          'PM bấm nút thêm thành viên, chọn người + vai trò, rồi lưu. Một người có thể giữ nhiều vai trò.',
        ],
      },
    ],
  },
  {
    id: 'co-docs',
    title: 'Tab "Tài liệu hợp đồng"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Kho tệp của hợp đồng, tổ chức theo CÂY THƯ MỤC giống như trong máy tính (thư mục cha → thư mục con → tệp).',
          'Hợp đồng mới tạo chưa có thư mục nào — bạn tự tạo cây thư mục theo nhu cầu (ví dụ: Hợp đồng ký, Hồ sơ kỹ thuật, Biên bản...).',
        ],
      },
      {
        heading: 'Cách thao tác',
        items: [
          'Tạo thư mục: bấm nút thêm thư mục, đặt tên, chọn thư mục cha (nếu là thư mục con).',
          'Tải tệp lên: mở thư mục đích rồi bấm nút tải lên và chọn tệp từ máy (Word, Excel, PDF, ảnh...).',
          'Xem tệp: bấm vào tên tệp — tệp mở ngay trên trình duyệt, không cần tải về.',
          'Chỉ PM/quản trị viên (và người được cấp quyền tài liệu) được tạo thư mục, tải lên, xóa.',
        ],
      },
    ],
  },
  {
    id: 'co-boq',
    title: 'Tab "Bảng giá" (danh mục hàng hóa)',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Danh mục hàng hóa/thiết bị của hợp đồng, xếp theo 3 CẤP: Phần (khu vực) → Nhóm → Thiết bị.',
          'CHỈ dòng THIẾT BỊ (cấp thấp nhất) có đơn giá và thành tiền; dòng Phần/Nhóm tự cộng dồn từ các dòng con.',
          'Tổng của toàn bảng chính là GIÁ TRỊ HỢP ĐỒNG — tự đồng bộ sang tab Thông tin.',
          'Chấm màu đầu dòng thể hiện tình hình nhập hàng cho dòng đó: 🔴 chưa nhập, 🟡 nhập một phần, 🟢 đã đủ (xem tab Theo dõi nhập hàng).',
        ],
      },
      {
        heading: 'Nhập bảng giá',
        items: [
          'Thêm dòng theo thứ tự: tạo Phần trước, rồi Nhóm trong Phần, rồi Thiết bị trong Nhóm (hoặc thêm thiết bị thẳng vào Phần nếu không cần nhóm).',
          'Với mỗi thiết bị nhập: tên hàng, đơn vị, số lượng, đơn giá — thành tiền tự tính.',
          'Nhóm có nút "✓ ×SL": bật lên khi nhóm là MỘT HỆ THỐNG bán theo bộ — thành tiền của nhóm sẽ nhân theo số lượng hệ thống.',
          'Sửa nhiều dòng rồi nhấn Ctrl+S để lưu tất cả một lượt.',
          'Dòng nào KHÔNG cần mua vào (ví dụ chi phí nhân công) thì tích "không cần nhập" để hệ thống bỏ qua khi tính độ phủ nhập hàng.',
        ],
      },
      {
        heading: 'Khóa bảng giá',
        items: [
          'Khi bảng giá đã chốt, Trưởng phòng/Phó phòng bấm nút khóa 🔒 — từ đó KHÔNG AI sửa được nữa (kể cả PM).',
          'Muốn sửa tiếp phải mở khóa: chỉ Trưởng phòng/Phó phòng mở được và phải nhập mật khẩu xác nhận.',
          'Thấy dòng chữ "Bảng giá đã khóa" nghĩa là bảng đang ở trạng thái khóa.',
        ],
      },
    ],
  },
  {
    id: 'co-supply',
    title: 'Tab "Theo dõi nhập hàng"',
    sections: [
      {
        heading: 'Màn hình thể hiện gì?',
        items: [
          'Trả lời câu hỏi: "hàng bán trong hợp đồng này đã MUA VÀO đủ chưa?" — từng dòng hàng bán được so với số lượng đã gắn từ các hợp đồng nhập.',
          'Màu từng dòng: 🔴 chưa có hàng nhập nào gắn vào, 🟡 đã gắn một phần nhưng chưa đủ số lượng, 🟢 đã đủ.',
          'Dòng đã tích "không cần nhập" (bên tab Bảng giá) không xuất hiện ở đây.',
        ],
      },
      {
        heading: 'Tách "đầu bán" (khi một hàng bán gồm nhiều món mua)',
        items: [
          'Ví dụ bán "Hệ thống camera" nhưng phải mua rời: camera, đầu ghi, ổ cứng — PM bấm tách dòng hàng bán thành các THÀNH PHẦN ("đầu bán") tương ứng.',
          'Sau khi tách, mỗi thành phần được theo dõi nhập riêng, màu tính theo từng thành phần.',
        ],
      },
      {
        heading: 'Gắn hàng nhập vào hàng bán',
        items: [
          'Việc gắn làm ở phía HỢP ĐỒNG NHẬP: người tạo HĐ nhập mở tab "Bảng giá mua", ở cột "Nhập cho" chọn dòng hàng bán (hoặc đầu bán) tương ứng.',
          'Một hợp đồng nhập có thể phục vụ nhiều hợp đồng bán: nếu HĐ nhập nằm ở hợp đồng bán khác nhưng được khai báo "nhập cho" hợp đồng này (tab Thông tin của HĐ nhập), hàng của nó vẫn gắn vào đây bình thường.',
          'Gắn xong, quay lại tab này sẽ thấy màu và số lượng cập nhật.',
        ],
      },
    ],
  },
]
