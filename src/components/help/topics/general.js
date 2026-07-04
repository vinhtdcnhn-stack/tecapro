// Nhóm hướng dẫn: Bắt đầu sử dụng & mẹo chung (hiện với mọi người dùng).

export const GENERAL_GROUP = {
  id: 'general',
  icon: '🚀',
  title: 'Bắt đầu & mẹo chung',
  pages: [
    {
      id: 'login',
      title: 'Đăng nhập & tài khoản',
      sections: [
        {
          heading: 'Đăng nhập lần đầu',
          items: [
            'Mở trình duyệt (Chrome, Edge...) và vào địa chỉ web của hệ thống do công ty cung cấp.',
            'Nhập Email và Mật khẩu được quản trị viên cấp, rồi bấm nút Đăng nhập.',
            'Nếu báo sai mật khẩu: kiểm tra phím Caps Lock, gõ lại chậm rãi. Vẫn không được thì liên hệ quản trị viên để cấp lại mật khẩu.',
          ],
        },
        {
          heading: 'Đổi mật khẩu',
          items: [
            'Bấm vào TÊN CỦA BẠN ở góc phải trên cùng màn hình (cạnh nút Đăng xuất).',
            'Cửa sổ đổi mật khẩu hiện ra: nhập mật khẩu cũ, mật khẩu mới 2 lần, rồi bấm lưu.',
            'Nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên.',
          ],
        },
        {
          heading: 'Nhận thông báo qua Telegram (tự cài đặt)',
          items: [
            'Hệ thống gửi thông báo (giao việc, chờ duyệt, cảnh báo...) qua bot Telegram @TecaproCNHNbot. Bạn tự bật, KHÔNG cần chờ quản trị viên, làm 3 bước một lần duy nhất.',
            'BƯỚC 1 — Kích hoạt bot (bắt buộc): mở app Telegram, gõ vào ô tìm kiếm 🔍 chính xác tên @TecaproCNHNbot, mở bot rồi bấm nút START (hoặc gửi /start). Nếu bỏ qua bước này, bot sẽ KHÔNG gửi được tin cho bạn dù đã khai báo ID đúng — đây là lỗi hay gặp nhất.',
            'BƯỚC 2 — Lấy Telegram ID của bạn: trên Telegram tìm bot @userinfobot (hoặc @myidbot), bấm START; bot trả về dòng "Id: 123456789" — dãy số đó chính là Telegram ID của bạn, copy lại.',
            'BƯỚC 3 — Khai báo vào hệ thống: bấm vào TÊN CỦA BẠN ở góc phải trên cùng (cạnh nút Đăng xuất) để mở cửa sổ, chọn thẻ "Telegram", dán dãy số ID vào ô "Telegram Chat ID" (chỉ dãy số, không dấu cách), bấm "Gửi thử" — nếu nhận được tin nhắn thử từ @TecaproCNHNbot là đúng, rồi bấm "Lưu Telegram".',
            'Đã lưu ID mà không nhận được tin? Gần như luôn do CHƯA bấm START với @TecaproCNHNbot ở Bước 1, hoặc đã lỡ chặn (block) bot — mở lại chat với bot và bỏ chặn.',
          ],
        },
        {
          heading: 'Đăng xuất',
          items: [
            'Bấm nút "Đăng xuất" ở góc phải trên cùng khi dùng xong, nhất là trên máy tính dùng chung.',
          ],
        },
      ],
    },
    {
      id: 'layout',
      title: 'Bố cục màn hình & menu',
      sections: [
        {
          heading: 'Thanh menu trên cùng',
          items: [
            'Các mục menu (Trang chủ, Hợp đồng bán, Công việc, Đề xuất, Tra cứu bảo hành, Hệ thống) nằm ngang trên cùng. Bấm vào mục nào thì mở trang đó.',
            'Bạn CHỈ thấy các mục mình được cấp quyền. Nếu thiếu mục cần dùng, liên hệ quản trị viên để được cấp quyền — không phải lỗi hệ thống.',
            'Mục "Đề xuất" có thể hiện huy hiệu 🔔 kèm con số: đó là số đơn đang chờ chính bạn duyệt — bấm vào để xử lý.',
            'Icon ❓ ở góc phải mở bảng hướng dẫn này.',
          ],
        },
        {
          heading: 'Trên điện thoại',
          items: [
            'Menu thu gọn vào nút ☰ ở góc phải trên — bấm để mở danh sách mục.',
            'Toàn bộ tính năng đều dùng được trên điện thoại, kể cả mục "Hệ thống" (Quản trị: người dùng, phòng ban, khách hàng, phân quyền, nhật ký…).',
            'Các bảng dữ liệu chuyển thành danh sách thẻ, mỗi thẻ là một dòng. Chạm vào thẻ để xem/sửa.',
            'Trong mục "Hệ thống", dải chọn nhóm chức năng (Quản lý người dùng, Phân quyền…) cuộn NGANG — vuốt trái/phải để thấy thêm.',
          ],
        },
      ],
    },
    {
      id: 'tips',
      title: 'Mẹo thao tác nhanh',
      sections: [
        {
          heading: 'Nhập liệu trong bảng',
          items: [
            'Nhiều bảng cho sửa trực tiếp ngay trên dòng: bấm vào ô cần sửa, gõ nội dung mới.',
            'Nhấn Ctrl+S để LƯU TẤT CẢ các dòng đang sửa dở cùng một lúc (thay vì bấm lưu từng dòng).',
            'Ô ngày tháng luôn gõ theo dạng ngày/tháng/năm, ví dụ: 04/07/2026.',
            'Ô số tiền tự thêm dấu chấm ngăn cách hàng nghìn khi bạn gõ (gõ 1000000 sẽ hiện 1.000.000).',
            'Số tiền tự làm tròn khi lưu: hợp đồng VND làm tròn về số nguyên, ngoại tệ giữ 2 chữ số thập phân.',
          ],
        },
        {
          heading: 'Sao chép thông tin một dòng',
          items: [
            'Nhấn CHUỘT PHẢI (trên điện thoại: ấn giữ) vào một dòng bất kỳ trong bảng.',
            'Chọn "Sao chép thông tin" — toàn bộ nội dung dòng đó được sao chép, dán được vào Zalo, email, tin nhắn... để trao đổi với đồng nghiệp.',
          ],
        },
        {
          heading: 'Phím tắt hữu ích',
          items: [
            'Ctrl+S: lưu các dòng đang sửa trong bảng.',
            'Ctrl+↑ / Ctrl+↓: trong trang chi tiết hợp đồng, chuyển nhanh giữa các mục ở cột trái.',
            'Esc: đóng cửa sổ/bảng đang mở (kể cả bảng hướng dẫn này).',
          ],
        },
        {
          heading: 'Thông báo Telegram',
          items: [
            'Khi bạn được giao việc mới, có đơn chờ duyệt... hệ thống gửi tin nhắn Telegram cho bạn.',
            'Bạn TỰ bật nhận thông báo: bấm vào tên mình ở góc phải trên → thẻ "Telegram" → nhập Chat ID → Gửi thử → Lưu. Xem chi tiết ở mục "Nhận thông báo qua Telegram (tự cài đặt)" trong trang Đăng nhập & tài khoản.',
          ],
        },
      ],
    },
    {
      id: 'feedback',
      title: 'Góp ý cải thiện phần mềm',
      sections: [
        {
          heading: 'Gửi góp ý khi gặp lỗi hoặc muốn cải tiến',
          items: [
            'Vào menu Hệ thống → mục "Góp ý" (mọi người dùng đều gửi được, không cần quyền đặc biệt).',
            'Gõ nội dung góp ý: mô tả bạn đang làm gì, bấm nút nào, màn hình hiện gì.',
            'Có ảnh chụp màn hình thì càng tốt: chụp màn hình (phím Print Screen hoặc Windows+Shift+S), rồi bấm vào ô nội dung và nhấn Ctrl+V để dán ảnh.',
            'Bấm gửi. Quản trị viên sẽ nhận được thông báo, xử lý và phản hồi ngay trong trang này — bạn quay lại xem trạng thái xử lý của từng góp ý đã gửi.',
          ],
        },
      ],
    },
  ],
}
