// Nhóm hướng dẫn: bảng điều khiển Kế toán (8 tab) + trang Tra cứu bảo hành.

export const ACCOUNTING_GROUP = {
  id: 'accounting',
  icon: '💰',
  title: 'Kế toán — báo cáo tài chính',
  pages: [
    {
      id: 'acc-overview',
      title: 'Tab "Tổng quan"',
      sections: [
        {
          heading: 'Cách mở & màn hình thể hiện gì?',
          items: [
            'Ở trang chủ, dùng nút đổi bảng điều khiển và chọn "Kế toán" (cần được cấp quyền xem bảng này).',
            'Tab "Tổng quan" tóm tắt tình hình dòng tiền: tổng phải thu, đã thu, nợ quá hạn, phải trả... kèm các cảnh báo cần chú ý.',
            'Dữ liệu tổng hợp tự động từ tab Công nợ/Thanh toán của từng hợp đồng — muốn số đúng thì các hợp đồng phải được cập nhật.',
          ],
        },
        {
          heading: 'Ai được xem bảng này?',
          items: [
            'Người được cấp quyền "Bảng điều khiển → Kế toán" ở trang Hệ thống → Phân quyền (cấp theo chức danh hoặc theo phòng ban). Cấp quyền này là xem được LUÔN toàn bộ số liệu của cả 8 tab — không phải cấp thêm gì nữa.',
            'Ngoài ra vẫn xem được nếu: là quản trị hệ thống; thuộc "Ban Kế Toán" hoặc "Ban Giám Đốc"; giữ chức danh Giám đốc / Phó giám đốc; hoặc là thành viên vai trò "Kế toán" của ít nhất một hợp đồng bán.',
            'Nếu vào bảng mà hiện khung vàng "Bạn chưa có quyền xem báo cáo tài chính" thì là do chưa được cấp quyền — KHÔNG phải mất dữ liệu. Nhờ quản trị cấp quyền ở trang Phân quyền rồi đăng nhập lại.',
          ],
        },
      ],
    },
    {
      id: 'acc-invoice',
      title: 'Tab "Xuất hóa đơn" (doanh thu theo hóa đơn)',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Danh sách hóa đơn đã xuất trong KHOẢNG NGÀY đang chọn, với các cột: Số hóa đơn, Ngày xuất, Số HĐ, CĐT (chủ đầu tư), Dự án, Loại tiền, Giá trị (nguyên tệ), Quy đổi VNĐ.',
            'Góc phải hiện "Tổng doanh thu" = tổng giá trị các hóa đơn trong khoảng ngày (kèm số lượng hóa đơn).',
            'Hóa đơn lấy từ tab "Quản lý hóa đơn" của từng hợp đồng bán.',
          ],
        },
        {
          heading: 'Cách dùng bộ lọc',
          items: [
            'Chọn "Từ ngày" / "Đến ngày" để xem doanh thu một giai đoạn bất kỳ.',
            'Ba nút bấm nhanh: "Tháng trước", "Tháng hiện tại", "Tháng sau" — tự đặt khoảng ngày theo tháng.',
            'Ô "Tìm kiếm" lọc nhanh theo số hóa đơn, số HĐ, chủ đầu tư hoặc dự án — gõ tới đâu bảng lọc tới đó, "Tổng doanh thu" cũng cập nhật theo kết quả lọc.',
            'Bấm nút "Excel" để tải bảng đang xem về file Excel.',
            'Máy nhớ khoảng ngày bạn chọn cho lần sau. Nếu bạn để mặc định "đến hôm nay" thì lần mở sau ô "Đến ngày" tự nhảy sang ngày hiện tại; còn nếu bạn tự gõ một mốc cụ thể thì máy giữ nguyên mốc đó.',
            'Khi ô "Đến ngày" nhỏ hơn hôm nay, thanh công cụ hiện dòng vàng "⚠ Chỉ tính tới ..." — nghĩa là hóa đơn xuất sau ngày đó CHƯA được tính. Bấm nút "Tới hôm nay" cạnh đó để xem đầy đủ.',
            'Nếu hiện "Không có hóa đơn nào trong khoảng ngày đã chọn" — thử nới rộng khoảng ngày.',
            'Hóa đơn NHÁP (chưa điền ngày xuất) không xuất hiện ở báo cáo này; phải điền "Ngày xuất" ở tab hóa đơn của hợp đồng thì mới được tính vào doanh thu.',
          ],
        },
      ],
    },
    {
      id: 'acc-overdue',
      title: 'Tab "Nợ quá hạn"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Chỉ liệt kê các khoản thu ĐÃ QUÁ HẠN mà chưa thu đủ — đây là danh sách cần đôn đốc gấp nhất.',
            'Mỗi dòng cho biết: hợp đồng nào, khách nào, số tiền còn thiếu, quá hạn bao nhiêu ngày.',
            'Số ngày quá hạn càng lớn càng cần ưu tiên xử lý; danh sách trống là tốt.',
            'Ô "Tìm kiếm" lọc nhanh theo mã KH, khách hàng, số HĐ hoặc nội dung khoản nợ.',
          ],
        },
      ],
    },
    {
      id: 'acc-receivables',
      title: 'Tab "Công nợ phải thu"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Toàn bộ các khoản KHÁCH CÒN NỢ MÌNH, cột gồm: Mã KH, Khách hàng, Số HĐ, Ngày HĐ, Nội dung (đợt thu), % theo HĐ, Cần thu, Đã thu, Còn nợ, Tiền tệ, Quy đổi VNĐ, Hạn thu, Số ngày quá hạn, Nhóm nợ.',
            '"% theo HĐ" là tỷ lệ đợt thu trên tổng giá trị hợp đồng; "Nhóm nợ" phân loại theo mức độ quá hạn.',
            'Số tiền tính theo nguyên tệ của hợp đồng; cột "Quy đổi VNĐ" chỉ để tham khảo.',
            'Ô "Tìm kiếm" lọc nhanh theo mã KH, khách hàng, số HĐ hoặc nội dung đợt thu; "Tổng còn nợ" và số khoản cập nhật theo kết quả lọc.',
            'Bấm nút Excel để xuất bảng; chuột phải một dòng → "Sao chép thông tin" để gửi cho người phụ trách.',
          ],
        },
      ],
    },
    {
      id: 'acc-payables',
      title: 'Tab "Công nợ phải trả"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Các khoản MÌNH CÒN NỢ NHÀ CUNG CẤP (từ tab Thanh toán của các hợp đồng nhập), cột gồm: Mã NCC, Nhà cung cấp, Số HĐ nhập, Ngày HĐ, Nội dung, Cần trả, Đã trả, Còn nợ, Tiền tệ, Quy đổi VNĐ, Hạn trả, Số ngày quá hạn, Nhóm nợ.',
            'Dùng để sắp xếp kế hoạch chi: khoản nào đến hạn trả trước, khoản nào đã quá hạn.',
            'Ô "Tìm kiếm" lọc nhanh theo mã NCC, nhà cung cấp, số HĐ nhập hoặc nội dung.',
          ],
        },
      ],
    },
    {
      id: 'acc-progress',
      title: 'Tab "Tiến độ thu"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Nhìn tổng thể việc thu tiền theo TỪNG HỢP ĐỒNG, cột gồm: Số HĐ, CĐT, Dự án, Ngày ký, Giá trị HĐ (VNĐ), Đã thu (VNĐ), Còn phải thu (VNĐ), Số ngày chậm, Phân loại.',
            'Trả lời câu hỏi: hợp đồng này đã thu được bao nhiêu phần, còn đọng bao nhiêu, có chậm không.',
            'Có ô "Tìm kiếm" (theo số HĐ, CĐT, dự án) dùng kèm hai ô lọc "Còn phải thu"; bấm "Xoá lọc" để bỏ hết điều kiện.',
          ],
        },
      ],
    },
    {
      id: 'acc-debt-summary',
      title: 'Tab "Tổng hợp theo KH/HĐ"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Gom công nợ theo TỪNG KHÁCH HÀNG, cột gồm: Mã KH, Khách hàng, Tổng HĐ (số hợp đồng), Tổng giá trị (VNĐ), Đã thu (VNĐ), Công nợ còn lại (VNĐ), Tỷ lệ thu.',
            'Cho biết khách nào đang chiếm dụng vốn nhiều nhất; mở rộng từng khách để xem chi tiết theo hợp đồng.',
            'Ô "Tìm kiếm" lọc theo mã/tên khách hàng, hoặc theo số HĐ / dự án của bất kỳ hợp đồng nào thuộc khách đó.',
            'Khi từ khóa khớp ở một HỢP ĐỒNG, khách hàng chứa nó tự bung ra và chỉ hiện những hợp đồng khớp; nếu khớp ở tên/mã KH thì giữ nguyên toàn bộ hợp đồng của khách đó.',
          ],
        },
      ],
    },
    {
      id: 'acc-warranty',
      title: 'Tab "Tình trạng bảo hành"',
      sections: [
        {
          heading: 'Màn hình thể hiện gì?',
          items: [
            'Tổng hợp bảo hành theo hợp đồng, cột gồm: Số HĐ, Khách hàng, Số thiết bị BH, Còn hạn, Hết hạn, Hết BH sớm nhất, Hết BH muộn nhất, Trạng thái.',
            'Giúp biết hợp đồng nào sắp hết nghĩa vụ bảo hành, hợp đồng nào còn nhiều thiết bị trong hạn.',
          ],
        },
      ],
    },
  ],
}

export const WARRANTY_GROUP = {
  id: 'warranty',
  icon: '🔧',
  title: 'Tra cứu bảo hành',
  perm: 'module.warranty_lookup.view',
  pages: [
    {
      id: 'wl-lookup',
      title: 'Tra cứu bảo hành theo serial',
      sections: [
        {
          heading: 'Cách tra cứu',
          items: [
            'Vào menu "Tra cứu bảo hành", gõ số serial của thiết bị vào ô "Nhập số serial..." rồi bấm tra cứu (hoặc Enter).',
            'Serial thường in trên tem dán ở thân thiết bị.',
          ],
        },
        {
          heading: 'Kết quả thể hiện gì?',
          items: [
            'Khối "🧾 Bảo hành cho khách hàng (Hợp đồng bán)": thiết bị bán theo hợp đồng nào, khách nào, hạn bảo hành CHO KHÁCH đến ngày nào, còn hạn hay hết.',
            'Khối bảo hành từ nhà cung cấp (Hợp đồng nhập): thiết bị được NCC bảo hành cho mình đến ngày nào — để biết có đòi được NCC không.',
            'Nếu thiết bị từng được ĐỔI MÁY, kết quả hiện cả thông tin "đã thay bằng serial ..." — tra serial cũ vẫn lần ra máy mới.',
            'Báo "Không tìm thấy serial" nghĩa là serial chưa được nhập vào hệ thống hoặc gõ nhầm — kiểm tra lại số trên tem.',
          ],
        },
      ],
    },
  ],
}
