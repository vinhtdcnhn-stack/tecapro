// Nhóm hướng dẫn: Hợp đồng nhập (mua vào) — nằm trong trang chi tiết hợp đồng bán,
// phần "II. Hợp đồng nhập", với các tab con riêng.

export const CONTRACT_IN_GROUP = {
  id: 'contract-in',
  icon: '📦',
  title: 'Hợp đồng nhập (mua vào)',
  perm: 'module.contracts.view',
  pages: [
    {
      id: 'ci-overview',
      title: 'Hợp đồng nhập là gì? Ai được tạo/sửa?',
      sections: [
        {
          heading: 'Khái niệm',
          items: [
            'Hợp đồng nhập là hợp đồng MUA HÀNG từ nhà cung cấp để có hàng giao cho hợp đồng bán.',
            'Mỗi hợp đồng nhập luôn gắn với một hợp đồng bán: mở hợp đồng bán → cột trái → phần "II. Hợp đồng nhập".',
            'Một hợp đồng bán có thể có nhiều hợp đồng nhập (mua từ nhiều nhà cung cấp).',
          ],
        },
        {
          heading: 'Quyền',
          items: [
            'Được TẠO hợp đồng nhập: PM chính hoặc người giữ vai trò Xuất nhập khẩu của hợp đồng bán.',
            'Sau khi tạo, chỉ NGƯỜI TẠO (và quản trị viên) được sửa/xóa dữ liệu bên trong.',
            'Riêng nhập SERIAL: người giữ vai trò Kỹ thuật triển khai cũng được nhập.',
          ],
        },
        {
          heading: 'Các tab con',
          items: [
            'Mỗi hợp đồng nhập có các tab: Thông tin, Tài liệu, Bảng giá mua, Nhận hàng, Quản lý Serial, Thanh toán, Tiến độ theo BB, Bảo hành NCC, Bảo lãnh, Xuất nhập khẩu, Theo dõi logistics — xem hướng dẫn từng tab bên dưới.',
          ],
        },
      ],
    },
    {
      id: 'ci-info',
      title: 'Tab "Thông tin"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Thông tin gốc của hợp đồng nhập: số HĐ, nhà cung cấp, ngày ký, loại tiền (VND, USD, EUR, JPY, CNY), hình thức mua ("Trong nước" hoặc "Nhập khẩu"), trạng thái (Active — đang thực hiện, Completed — hoàn thành, Cancelled — hủy).',
            'Người tạo điền/sửa các trường rồi lưu; giá trị hợp đồng tự tính từ tab "Bảng giá mua".',
          ],
        },
      ],
    },
    {
      id: 'ci-docs',
      title: 'Tab "Tài liệu"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Kho tệp riêng của hợp đồng nhập, dùng giống tab Tài liệu của hợp đồng bán: tạo thư mục, tải tệp lên, bấm tên tệp để xem trên trình duyệt.',
            'Nên lưu: hợp đồng ký với NCC, invoice, packing list, chứng từ thanh toán...',
          ],
        },
      ],
    },
    {
      id: 'ci-pricing',
      title: 'Tab "Bảng giá mua"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Danh mục hàng mua từ nhà cung cấp: tên hàng, đơn vị, số lượng, đơn giá, thành tiền — tổng là giá trị hợp đồng nhập.',
            'Cột "Nhập cho": mỗi dòng hàng mua được GẮN vào dòng hàng bán (hoặc "đầu bán") của hợp đồng bán mà nó phục vụ.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Người tạo thêm từng dòng hàng, nhập số lượng + đơn giá; Ctrl+S lưu nhiều dòng một lượt.',
            'Ở cột "Nhập cho", chọn đúng dòng hàng bán tương ứng — nhờ đó tab "Theo dõi nhập hàng" bên hợp đồng bán biết hàng đã được mua (chấm màu 🔴/🟡/🟢).',
            'Một dòng hàng bán có thể nhận hàng từ nhiều hợp đồng nhập khác nhau.',
          ],
        },
      ],
    },
    {
      id: 'ci-delivery',
      title: 'Tab "Nhận hàng"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Ghi nhận các ĐỢT NHẬN HÀNG thực tế từ nhà cung cấp: ngày nhận, hàng gì, số lượng bao nhiêu.',
            'So sánh với số lượng đặt mua ở Bảng giá mua để biết NCC đã giao đủ chưa, còn thiếu gì.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Mỗi lần nhận hàng về kho: thêm một đợt nhận, chọn các dòng hàng + số lượng nhận, kèm ngày và ghi chú.',
          ],
        },
      ],
    },
    {
      id: 'ci-serials',
      title: 'Tab "Quản lý Serial"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Danh sách SERIAL của từng thiết bị mua về — căn cứ để theo dõi bảo hành từ nhà cung cấp.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Người tạo hợp đồng (hoặc Kỹ thuật triển khai) nhập serial cho từng dòng hàng; có thể dán nhiều serial cùng lúc.',
            'Serial phải DUY NHẤT trong toàn bộ hợp đồng nhập của hệ thống (không phân biệt hoa/thường); trùng sẽ báo lỗi. Serial bên nhập và bên bán được phép trùng nhau (là cùng một thiết bị).',
          ],
        },
      ],
    },
    {
      id: 'ci-payment',
      title: 'Tab "Thanh toán"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Kế hoạch TRẢ TIỀN cho nhà cung cấp theo các đợt: nội dung, số tiền, hạn trả, đã trả bao nhiêu, còn nợ bao nhiêu.',
            'Số liệu ở đây đổ vào báo cáo "Công nợ phải trả" của bảng điều khiển Kế toán; đợt quá hạn trả sẽ bị cảnh báo.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Thêm từng đợt trả theo điều khoản hợp đồng; khi chuyển tiền cho NCC thì ghi nhận số đã trả vào đúng đợt.',
          ],
        },
      ],
    },
    {
      id: 'ci-progress',
      title: 'Tab "Tiến độ theo BB"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Ghi nhận các biên bản ký với NHÀ CUNG CẤP (giao nhận, nghiệm thu, thanh lý...) — giống tab "Tiến độ theo biên bản" bên hợp đồng bán nhưng cho chiều mua vào.',
            'Thêm dòng: chọn loại biên bản, số, ngày ký, ghi chú.',
          ],
        },
      ],
    },
    {
      id: 'ci-warranty',
      title: 'Tab "Bảo hành NCC"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Thời hạn nhà cung cấp bảo hành cho thiết bị MÌNH MUA: thiết bị/serial nào được NCC bảo hành đến ngày nào.',
            'Khi thiết bị của khách hỏng, tra ở đây để biết còn đòi được bảo hành từ NCC hay không.',
            'Dữ liệu này cũng hiện trong trang "Tra cứu bảo hành" (khối bảo hành từ nhà cung cấp).',
          ],
        },
      ],
    },
    {
      id: 'ci-guarantee',
      title: 'Tab "Bảo lãnh"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Theo dõi các thư bảo lãnh liên quan hợp đồng nhập (bảo lãnh thanh toán, tạm ứng...): ngân hàng, số tiền, ngày hết hạn.',
            'Theo dõi hạn để kịp xử lý trước khi hết hiệu lực.',
          ],
        },
      ],
    },
    {
      id: 'ci-customs',
      title: 'Tab "Xuất nhập khẩu"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Dành cho hàng NHẬP KHẨU: theo dõi hồ sơ thông quan — tờ khai hải quan, giấy phép, chứng từ liên quan, ngày hoàn tất.',
            'Người phụ trách xuất nhập khẩu cập nhật từng bước để cả nhóm biết hàng đang ở khâu nào.',
          ],
        },
      ],
    },
    {
      id: 'ci-logistics',
      title: 'Tab "Theo dõi logistics"',
      sections: [
        {
          heading: 'Cách dùng',
          items: [
            'Theo dõi quá trình VẬN CHUYỂN lô hàng: hãng vận chuyển, số vận đơn, ngày hàng đi, dự kiến đến, tình trạng hiện tại.',
            'Cập nhật mỗi khi có tin mới từ hãng tàu/forwarder để mọi người nắm được hàng về đến đâu.',
          ],
        },
      ],
    },
  ],
}
