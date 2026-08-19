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
        {
          heading: 'HĐ bán được cung cấp (Nhập cho nhiều hợp đồng bán)',
          items: [
            'Một hợp đồng nhập có thể cung cấp hàng cho NHIỀU hợp đồng bán khác nhau. Phần "HĐ bán được cung cấp (Nhập cho)" ở cuối tab Thông tin liệt kê các hợp đồng bán mà HĐ nhập này phục vụ.',
            'Hợp đồng bán "gốc" (nơi tạo ra HĐ nhập, có nhãn "HĐ gốc") luôn nằm trong danh sách và KHÔNG bỏ được.',
            'Để thêm: gõ số HĐ, tên dự án hoặc tên khách hàng vào ô tìm rồi chọn. Ô này tìm được MỌI hợp đồng bán trong hệ thống — kể cả hợp đồng bạn không phải thành viên — vì một hợp đồng nhập thường mua hàng phục vụ dự án của người khác. Khi đã thêm, HĐ nhập này sẽ hiện trong danh sách "Hợp đồng nhập" của hợp đồng bán đó (kèm nhãn "Dùng chung").',
            'Thêm hoặc bỏ một hợp đồng bán sẽ gửi thông báo Telegram cho PM của hợp đồng bán đó, để họ biết dự án của mình đang được cung cấp hàng từ hợp đồng nhập nào.',
            'Sau khi thêm, khi bạn mở hợp đồng nhập TỪ hợp đồng bán vừa link, cột "Nhập cho" (tab Bảng giá mua) sẽ cho gắn hàng nhập vào hàng bán của chính hợp đồng bán đó.',
            'KHÔNG bỏ được một hợp đồng bán khỏi danh sách nếu đã có hàng nhập gắn vào Theo dõi nhập hàng của nó — phải bỏ ghép ở cột "Nhập cho" (tab Bảng giá mua) trước.',
            'Ai được thêm/bớt: người TẠO hợp đồng nhập, PM của hợp đồng bán GỐC (hợp đồng có nhãn "HĐ gốc"), hoặc admin. Không thuộc ba nhóm này thì ô tìm không hiện và nút ✕ bị mờ.',
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
            'Cột "Nhập cho": mỗi dòng hàng mua được GẮN vào dòng hàng bán (hoặc "đầu bán") của hợp đồng bán mà nó phục vụ. Cột này chỉ hiện/chọn hàng bán của HỢP ĐỒNG BÁN ĐANG MỞ — bạn đứng ở hợp đồng bán nào thì gắn hàng nhập cho hợp đồng bán đó (một HĐ nhập dùng chung khi mở từ hợp đồng bán khác sẽ hiện ghép của hợp đồng bán kia).',
            'Chặn quá nhập: tổng số lượng đã "nhập cho" (cộng cả các hợp đồng bán khác) không vượt quá SỐ LƯỢNG MUA của dòng — phần còn nhập được hiển thị ngay dưới ô, tự trừ khi bạn gắn thêm.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Người tạo thêm từng dòng hàng, nhập số lượng + đơn giá; Ctrl+S lưu nhiều dòng một lượt.',
            'Ở cột "Nhập cho", chọn đúng dòng hàng bán tương ứng — nhờ đó tab "Theo dõi nhập hàng" bên hợp đồng bán biết hàng đã được mua (chấm màu 🔴/🟡/🟢).',
            'AI ĐƯỢC GHÉP: người tạo hợp đồng nhập, admin, và PM CỦA HỢP ĐỒNG BÁN ĐANG XEM. Nếu bạn là PM của hợp đồng bán mà hợp đồng nhập lại do người khác tạo: mở hợp đồng bán CỦA BẠN → tab "Hợp đồng nhập" → chọn hợp đồng nhập dùng chung → tab "Bảng giá mua". Lúc đó các ô tên hàng, số lượng, đơn giá đều mờ (không sửa được vì không phải hợp đồng của bạn), riêng cột "Nhập cho" vẫn dùng bình thường — bạn tự ghép hàng cho dự án của mình.',
            'Một dòng hàng bán có thể nhận hàng từ nhiều hợp đồng nhập khác nhau.',
            'Trên điện thoại, bảng chuyển thành danh sách thẻ: chạm vào một thẻ để mở ô sửa dòng đó (tên hàng, ĐVT, số lượng, đơn giá, VAT, bảo hành). Riêng cột "Nhập cho" phải làm trên máy tính.',
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
            'Bảng xếp theo 2 tầng giống tab Công nợ của hợp đồng bán: mỗi KHOẢN PHẢI TRẢ (theo điều khoản hợp đồng) là một dòng, ngay bên dưới nó là các ĐỢT THANH TOÁN thực tế đã chi cho khoản đó.',
            'Cuối mỗi khoản có dòng so sánh: Phải trả — Đã trả — Còn thiếu (hoặc Thừa nếu chi vượt).',
            'Số liệu ở đây đổ vào báo cáo "Công nợ phải trả" của bảng điều khiển Kế toán; đợt quá hạn trả sẽ bị cảnh báo.',
          ],
        },
        {
          heading: 'Nhãn trạng thái dưới ô "Thời hạn trả"',
          items: [
            'Nhãn được tính theo SỐ TIỀN ĐÃ TRẢ THỰC TẾ của chính khoản đó, không chỉ nhìn ngày hạn.',
            '"Chưa đến hạn" (xám): chưa trả đồng nào và vẫn còn trong hạn.',
            '"Đang trả" (xanh dương): đã trả một phần, vẫn còn trong hạn.',
            '"Quá hạn N ngày" (đỏ): quá ngày hạn mà vẫn còn thiếu tiền — kèm chữ "trả một phần" nếu đã trả được một ít. Lúc này ô "Nguyên nhân trượt" viền đỏ nhắc nhập lý do.',
            '"Đã trả đủ" (xanh lá): tổng các đợt thanh toán đã bằng hoặc vượt giá trị khoản — khoản này KHÔNG còn bị coi là quá hạn nữa, dù ngày hạn đã trôi qua.',
            '"Đã trả đủ · trễ N ngày" (vàng): đã trả đủ nhưng đợt trả cuối cùng rơi sau ngày hạn — ghi nhận là trả chậm để theo dõi, không phải nợ.',
          ],
        },
        {
          heading: 'Cách thao tác',
          items: [
            'Bước 1 — Thêm khoản: bấm "Thêm khoản" ở góc phải, nhập mô tả điều kiện thanh toán (VD "30% tạm ứng khi ký"), phương thức, đồng tiền, giá trị, hạn trả, rồi lưu dòng.',
            'Bước 2 — Ghi nhận tiền đã chuyển: bấm "Thêm đợt thanh toán" NẰM NGAY DƯỚI khoản tương ứng, nhập ngày chuyển tiền, số tiền, ghi chú. Phải lưu khoản phải trả trước thì nút này mới bấm được.',
            'Đợt thanh toán tự dùng đồng tiền và tỷ giá của khoản chứa nó, không phải chọn lại.',
            'Nhấn Ctrl+S để lưu một lượt tất cả khoản và đợt đang sửa.',
            'Xóa một khoản phải trả thì các đợt thanh toán của nó KHÔNG mất — chúng rơi xuống mục "Đợt thanh toán chưa gắn khoản" ở cuối trang.',
            'Mục "Đợt thanh toán chưa gắn khoản" chỉ hiện khi có dữ liệu như vậy (thường là đợt nhập từ trước khi có cách xếp 2 tầng): chọn khoản ở cột "Gắn vào khoản" rồi lưu là đợt nhảy vào đúng khoản ở bảng trên.',
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
