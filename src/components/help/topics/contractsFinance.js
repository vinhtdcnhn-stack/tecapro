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
          'Mỗi dòng gồm: loại biên bản, "Ngày theo HĐ", "Ngày dự kiến", ngày thực tế đã ký, nguyên nhân chậm trễ và "Ghi chú" — thể hiện hợp đồng đã đi đến bước nào.',
          'Cột cuối tên là "Ghi chú" (trước đây gọi là "Biên bản phạt") — ghi tự do bất cứ điều gì cần lưu ý về biên bản đó, không bắt buộc phải là chuyện phạt.',
          'Danh mục "loại biên bản" do quản trị viên khai báo ở menu Hệ thống; nếu thiếu loại cần dùng, báo quản trị viên thêm.',
        ],
      },
      {
        heading: 'Cách thêm biên bản',
        items: [
          'PM bấm nút thêm, chọn loại biên bản, điền 2 cột ngày, ngày thực tế khi đã ký, rồi lưu (hoặc Ctrl+S để lưu tất cả dòng đang sửa).',
          'Bản scan của biên bản nên tải lên tab "Tài liệu hợp đồng" để tra cứu sau này.',
        ],
      },
      {
        heading: 'Hai cột ngày và công thức tính tự động',
        items: [
          'Cột "Ngày theo HĐ" = hạn cam kết trong hợp đồng. Ô chọn bên trái quyết định cách lấy ngày: "Nhập ngày" là tự gõ; "Ngày ký HĐ" là ngày ký hợp đồng cộng thêm số ngày; hoặc chọn mã một biên bản khác để tính từ NGÀY THEO HĐ của biên bản đó.',
          'Cột "Ngày dự kiến" = dự báo theo thực tế. Ô chọn bên trái: "BB trước" (mặc định, tính từ ngày THỰC TẾ của biên bản liền trên), "Ngày ký HĐ", hoặc mã một biên bản khác — rồi nhập số ngày.',
          'Khác nhau ở chỗ: "Ngày theo HĐ" tính theo hạn giấy tờ, còn "Ngày dự kiến" tính theo ngày THỰC TẾ đã ký của mốc gốc, nên mốc gốc chưa ký thì ô này còn trống.',
          'Tab "Tiến độ theo BB" bên hợp đồng NHẬP nay dùng đúng cách tính này — chỉ khác mốc "Ngày ký HĐ" là ngày ký của hợp đồng nhập.',
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
        heading: 'Đợt nháp — tạo sẵn nhiều đợt cùng lúc',
        items: [
          'Một đợt chỉ được coi là ĐÃ XUẤT khi có ĐỦ cả Số hóa đơn VÀ Ngày xuất. Thiếu một trong hai thì đợt đó là NHÁP.',
          'Đợt nháp KHÔNG bị trừ vào "Đã xuất" và không tính vào công nợ/doanh thu — số lượng của nó vẫn nằm ở cột "Tồn chưa xuất" của bảng tồn.',
          'Bạn CÓ THỂ tạo sẵn nhiều đợt nháp cùng lúc để chia trước kế hoạch xuất hóa đơn, rồi hoàn thiện (điền Số HĐ + Ngày xuất) dần.',
          'Để không xuất vượt hợp đồng: khi thêm hàng cho một đợt, cột "Còn có thể xuất" (trong bảng chọn hàng) đã TỰ TRỪ số lượng đang nằm ở các đợt khác — cả đợt nháp lẫn đợt đã xuất. Vượt số này sẽ bị báo lỗi khi lưu.',
          'Ở bảng "Tồn chưa xuất hóa đơn theo bảng giá", khi có đợt nháp sẽ hiện thêm cột "Đang trong nháp" để bạn biết mỗi mặt hàng đã đưa vào các đợt nháp bao nhiêu (số này chưa bị trừ khỏi "Tồn chưa xuất").',
        ],
      },
      {
        heading: 'Khóa đợt xuất hóa đơn',
        items: [
          'Đợt đã chốt thì bấm nút 🔓 "Khóa" — từ đó KHÔNG ai sửa/xóa đợt đó được nữa (kể cả PM) cho tới khi mở khóa.',
          'CHỈ KẾ TOÁN CỦA DỰ ÁN mới thấy và bấm được nút Khóa — tức người có tên ở mục "Kế toán" trong tab Thông tin hợp đồng. PM hay người khác không khóa được.',
          'MỞ KHÓA: chỉ ĐÚNG NGƯỜI đã khóa đợt đó mới mở được, và phải nhập lại mật khẩu để xác nhận. Kế toán khác của cùng dự án cũng không mở hộ được.',
          'Dòng đợt đã khóa hiện nhãn 🔒 kèm tên người khóa và thời điểm khóa (rê chuột vào nhãn để xem giờ).',
          'Quản trị viên là ngoại lệ duy nhất: khóa và mở khóa được mọi đợt — dùng khi kế toán nghỉ/chuyển việc.',
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
      {
        heading: 'Thêm thiết bị: LẤY TỪ BẢNG GIÁ (khuyến nghị)',
        items: [
          'Ở tab con "Thiết bị bàn giao", bấm "+ Thêm thiết bị" (hoặc ✏️ ở dòng có sẵn) để mở ô "Thêm/Cập nhật thiết bị".',
          'Ô đầu tiên "Lấy từ bảng giá": chọn đúng DÒNG HÀNG trong bảng giá của hợp đồng. Khi đã chọn, TÊN THIẾT BỊ và MỐC BẢO HÀNH lấy thẳng từ dòng đó — tên hiện ở ô chỉ-xem (không gõ tay được) để hai bên luôn khớp nhau.',
          'Chọn dòng bảng giá xong, số lượng được điền sẵn theo bảng giá (thêm mới) — sửa lại nếu đợt này chỉ giao một phần.',
          'Dòng thiết bị nào đang lấy từ bảng giá thì ở bảng có nhãn nhỏ "🔗 bảng giá" cạnh tên.',
          'Chọn "— Không gắn: tự nhập tên và mốc bảo hành —" cho trường hợp đặc biệt (hàng không có trong bảng giá): lúc đó nhập tên và ngày bảo hành tay như trước.',
          'Đổi tên hàng ở tab Bảng giá thì tên thiết bị bàn giao tự đổi theo; xóa dòng bảng giá thì thiết bị trở về chế độ tự nhập (không mất dữ liệu).',
        ],
      },
      {
        heading: 'Hạn bảo hành ("Bảo hành từ" / "Bảo hành đến")',
        items: [
          'Ô "Bảo hành từ" = chọn một BIÊN BẢN (danh sách lấy từ tab "Tiến độ theo biên bản"); mốc bảo hành = NGÀY THỰC TẾ của biên bản đó. Thiết bị KHÔNG gắn bảng giá thì còn cách "Nhập ngày" để gõ tay.',
          'Ô "Bảo hành đến" = số THÁNG kể từ "Bảo hành từ" (VD 36). Thiết bị không gắn bảng giá còn được chọn "Nhập ngày" để gõ ngày hết hạn tay.',
          'Ngay dưới mỗi ô, phần mềm hiện kết quả đã tính: "→ BH từ: 30/08/2026" và "→ BH đến: 30/08/2029". Đây chính là 2 ngày được lưu và dùng cho trang "Tra cứu bảo hành".',
          'QUAN TRỌNG — thiết bị đang gắn bảng giá: sửa mốc/số tháng ở đây là SỬA LUÔN DÒNG BẢNG GIÁ (hai nơi không bao giờ lệch nhau).',
          'Vì vậy chỉ người có quyền sửa bảng giá mới đổi được, và bảng giá đang KHÓA thì hai ô này chuyển sang chỉ-xem kèm dòng nhắc 🔒 — mở khóa bảng giá (Trưởng/Phó phòng) rồi mới sửa được.',
          'Biên bản chưa điền ngày thực tế thì chưa ra được hạn: dòng kết quả ghi "biên bản chưa có ngày thực tế". Vào tab "Tiến độ theo biên bản" điền ngày thực tế — hạn bảo hành của MỌI thiết bị gắn bảng giá tự tính lại ngay, không phải sửa từng cái.',
          'Nút "Sửa bảo hành hàng loạt" chỉ áp cho thiết bị KHÔNG gắn bảng giá; thiết bị đã gắn sẽ bị bỏ qua và phần mềm báo lại số lượng — muốn đổi thì sửa ở bảng giá.',
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
          'Mỗi dòng: loại bảo lãnh, giá trị, % so với GTHĐ (giá trị hợp đồng sau VAT), ngày phát hành, ngày HẾT HẠN.',
          'Theo dõi ngày hết hạn để kịp gia hạn hoặc lấy lại bảo lãnh — tránh bị ngân hàng tự động gia hạn tốn phí.',
          'Nhãn màu bên cạnh ô trạng thái là TỰ TÍNH theo ngày hết hạn, không phải ô trạng thái bạn chọn: "Còn hiệu lực" (còn trên 30 ngày), "Sắp hết hạn" (còn 30 ngày trở xuống, kèm dòng "Còn N ngày"), "Đã hết hạn" (đã qua ngày hết hạn, kèm "Quá hạn N ngày"). Riêng thư đã chọn "Đã hoàn trả" thì giữ nguyên, không tính theo ngày nữa.',
          'Ngày hết hạn tính theo NGÀY LỊCH: đúng ngày hết hạn vẫn là "Sắp hết hạn · Còn 0 ngày", sang ngày hôm sau mới chuyển thành "Đã hết hạn".',
          '4 ô thống kê phía trên (Còn hiệu lực / Sắp hết hạn / Đã hết hạn) đếm theo chính nhãn tự tính này nên luôn khớp với các dòng bên dưới.',
        ],
      },
      {
        heading: 'Cách thao tác',
        items: [
          'PM/Kế toán bấm thêm, nhập thông tin thư bảo lãnh rồi lưu; hết hiệu lực thì cập nhật trạng thái.',
          'Ô "Giá trị" và ô "% so với GTHĐ" LIÊN ĐỘNG: nhập % thì tự ra số tiền (theo giá trị hợp đồng sau VAT), nhập số tiền thì tự ra %. Chỉ cần điền một trong hai. (Nếu hợp đồng chưa có giá trị từ bảng giá thì ô % bị mờ, hãy nhập trực tiếp số tiền.)',
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
          'TỰ THÊM VÀO DANH SÁCH KỸ THUẬT: khi Trưởng ban / Phó ban của Ban Dự án và chuyển giao công nghệ hoặc Ban Kỹ thuật chuyển việc cho một người của hai ban này, người đó được tự động thêm vào danh sách "Kỹ thuật" của hợp đồng (nếu chưa có) — không phải vào tab Thông tin hợp đồng thêm tay. Hộp thoại chuyển việc sẽ báo trước khi điều này xảy ra, và người nhận được thông báo Telegram là đã vào hợp đồng với vai trò Kỹ thuật.',
        ],
      },
      {
        heading: 'Báo hoàn thành và xác nhận kết quả',
        items: [
          'NGƯỜI ĐƯỢC GIAO: làm xong thì tự mở ô "Trạng thái" ở dòng việc của mình và chọn "Hoàn thành" — không cần chờ ai đổi hộ.',
          'Ngay sau đó việc hiện thêm dấu ⏳ "chờ xác nhận": nghĩa là đã báo xong nhưng người giao việc chưa kiểm tra. Đưa chuột vào dấu ⏳ để xem ai báo, báo lúc nào.',
          'NGƯỜI GIAO VIỆC (và PM của hợp đồng, quản trị viên) nhìn thấy 2 nút nhỏ ngay cạnh dấu ⏳: ✔ để xác nhận, ✘ để báo chưa đạt. Cũng có thể bấm vào việc để mở ngăn chi tiết rồi bấm nút "✔ Xác nhận hoàn thành" / "✘ Chưa đạt" cho dễ nhìn.',
          'Bấm ✔ Xác nhận: việc được chốt hoàn thành, hệ thống ghi lại ai xác nhận và lúc nào, đồng thời mở khóa các việc phải chờ việc này xong.',
          'Bấm ✘ Chưa đạt: BẮT BUỘC gõ lý do (nêu rõ còn thiếu gì). Việc quay lại "Đang thực hiện", lý do được ghi vào DÒNG THỜI GIAN trao đổi của việc và người thực hiện nhận thông báo Telegram kèm nội dung.',
          'Việc từng bị trả lại sẽ hiện dòng đỏ "Bị trả lại N lần — lý do gần nhất..." trong ngăn chi tiết, để người thực hiện biết phải xử lý gì.',
          'Nếu bạn vừa là người giao vừa là người làm (tự giao việc cho mình), chọn "Hoàn thành" là chốt luôn, không phải qua bước xác nhận.',
          'Việc CÓ VIỆC CON không đổi trạng thái bằng tay được (hiện khóa 🔒) — nó tự tính theo các việc con.',
        ],
      },
      {
        heading: 'Trao đổi trong việc',
        items: [
          'Bấm vào một việc để mở ngăn chi tiết bên phải: xem người thực hiện, người GIAO việc, hạn hoàn thành, và dòng thời gian TRAO ĐỔI — gõ nội dung báo cáo tiến độ, vướng mắc, đính kèm tệp.',
          'ĐÍNH KÈM TỆP: bấm "📎 Thêm tệp / ảnh" trong ô soạn để chọn ẢNH hoặc TÀI LIỆU (PDF, Word, Excel, file nén...). Ảnh vẫn dán thẳng được bằng Ctrl+V vào ô nội dung.',
          'Ảnh hiện thu nhỏ ngay trong dòng thời gian (bấm để phóng to); tài liệu hiện thành liên kết 📎 kèm tên và dung lượng — bấm để mở hoặc tải về. Dùng cách này khi Kỹ thuật phản hồi kết quả nhận / kiểm tra hàng bằng file.',
          'Trên điện thoại có 3 nút: 📷 chụp ảnh, 🖼️ chọn ảnh, 📎 chọn tài liệu.',
          'Không cần gõ chữ nếu chỉ muốn gửi tệp — cứ chọn tệp rồi bấm Gửi.',
          'Việc có trao đổi mới bạn chưa đọc sẽ tô NỀN HỔ PHÁCH trên các bảng theo dõi (kể cả trang chủ).',
        ],
      },
      {
        heading: 'Nhắc hạn qua Telegram',
        items: [
          'CÒN 7 NGÀY TỚI HẠN: người thực hiện nhận MỘT thông báo 🔔 "Công việc sắp tới hạn (còn ≤ 7 ngày)" — chỉ nhắc ĐÚNG MỘT LẦN cho mỗi việc, không lặp lại mỗi ngày.',
          'Nếu sau đó hạn hoàn thành được sửa sang ngày khác thì việc được nhắc lại một lần nữa cho hạn mới.',
          'ĐẾN HẠN / QUÁ HẠN: vẫn nhắc hằng ngày như trước cho tới khi việc chuyển sang "Hoàn thành".',
          'Việc đã "Hoàn thành" hoặc chưa có người thực hiện thì không nhắc. Ai chưa khai Telegram trong hồ sơ cá nhân sẽ không nhận được tin.',
          'Giờ nhắc: 08:15 và 13:45 (giờ Việt Nam), thứ Hai đến thứ Sáu.',
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
