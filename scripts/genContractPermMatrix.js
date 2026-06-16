// Sinh file Excel "Ma trận phân quyền — Module Hợp đồng bán" để chuyển khách hàng xác định.
// Chạy: node scripts/genContractPermMatrix.js
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

XLSX.set_fs(fs)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const Y = '✔'        // có quyền
const _ = ''          // không có quyền (để trống)

// Thứ tự cột vai trò
const ROLES = ['Admin', 'PM', 'Kinh doanh', 'Presale', 'Kỹ thuật', 'Kế toán', 'Người theo dõi', 'User khác']

// Bộ mark sẵn (theo HIỆN TRẠNG hệ thống để khách dễ điều chỉnh)
const V = [Y, Y, Y, Y, Y, Y, Y, Y]              // Xem: mọi user đăng nhập
const W = [Y, Y, _, _, _, _, _, _]              // Ghi: chỉ Admin + PM của HĐ
const ALL = [Y, Y, Y, Y, Y, Y, Y, Y]
const NONE = [_, _, _, _, _, _, _, _]
const ADMIN_ONLY = [Y, _, _, _, _, _, _, _]     // chỉ Admin

// Cột "Người được giao việc" (assignee) — chủ thể riêng, áp dụng cho phần Công việc.
// '—' = không áp dụng. Mặc định điền theo HIỆN TRẠNG (assignee xem được, nhưng chưa
// được tự sửa nếu không phải PM).
const NA = '—'
function assigneeFor(group, func) {
  if (!group.startsWith('G.')) return NA           // ngoài phần Công việc: không áp dụng
  return func.startsWith('Xem') ? Y : _            // xem: được; các thao tác ghi: hiện chưa
}

// [Nhóm, Chức năng/Thao tác, Mô tả, Hiện trạng (tham chiếu), ...8 mark]
const data = [
  // A. Danh sách & thông tin hợp đồng
  ['A. Danh sách & Thông tin HĐ', 'Xem danh sách hợp đồng bán', 'Mở danh sách, tìm kiếm, lọc HĐ', 'Mọi user đăng nhập', ...V],
  ['A. Danh sách & Thông tin HĐ', 'Xem chi tiết 1 hợp đồng', 'Thông tin HĐ + danh sách nhân sự', 'Mọi user đăng nhập', ...V],
  ['A. Danh sách & Thông tin HĐ', 'Tạo hợp đồng bán mới', 'Nhập số HĐ, ngày ký, giá trị, nhân sự…', 'HIỆN: mọi user đăng nhập tạo được — nên cân nhắc giới hạn', ...ALL],
  ['A. Danh sách & Thông tin HĐ', 'Sửa thông tin hợp đồng', 'Số HĐ, ngày, giá trị, điều khoản, trạng thái', 'PM của HĐ + Admin', ...W],
  ['A. Danh sách & Thông tin HĐ', 'Phân công / đổi nhân sự', 'Gán PM, Kinh doanh, Presale, Kỹ thuật, Kế toán, Theo dõi', 'PM của HĐ + Admin', ...W],
  ['A. Danh sách & Thông tin HĐ', 'Xóa hợp đồng bán', 'Xóa toàn bộ HĐ', 'CHƯA có chức năng — cần khách hàng xác định', ...NONE],

  // B. Bảng giá (BOQ)
  ['B. Bảng giá (BOQ)', 'Xem bảng giá BOQ', 'Xem danh mục, đơn giá, thành tiền', 'Mọi user đăng nhập', ...V],
  ['B. Bảng giá (BOQ)', 'Thêm / sửa dòng BOQ', 'Hạng mục, khối lượng, đơn giá', 'PM của HĐ + Admin', ...W],
  ['B. Bảng giá (BOQ)', 'Xóa dòng BOQ', 'Xóa hạng mục', 'PM của HĐ + Admin', ...W],
  ['B. Bảng giá (BOQ)', 'Nhập BOQ từ Excel (import)', 'Tải lên file Excel để nạp hàng loạt', 'PM của HĐ + Admin', ...W],
  ['B. Bảng giá (BOQ)', 'Xuất / In bảng giá', 'Kết xuất Excel / in', 'Mọi user đăng nhập', ...V],

  // C. Tài liệu
  ['C. Tài liệu', 'Xem cây thư mục & danh sách tài liệu', 'Duyệt thư mục, file đính kèm', 'Mọi user đăng nhập', ...V],
  ['C. Tài liệu', 'Tạo / đổi tên / xóa thư mục', 'Quản lý cây thư mục', 'PM của HĐ + Admin', ...W],
  ['C. Tài liệu', 'Tải lên (upload) tài liệu', 'Đẩy file vào thư mục', 'PM của HĐ + Admin', ...W],
  ['C. Tài liệu', 'Xem / tải xuống tài liệu', 'Mở, tải file về', 'Mọi user đăng nhập', ...V],
  ['C. Tài liệu', 'Xóa tài liệu', 'Xóa file', 'PM của HĐ + Admin', ...W],

  // D. Tiến độ
  ['D. Tiến độ', 'Xem tiến độ thực hiện', 'Xem các mốc/tiến độ', 'Mọi user đăng nhập', ...V],
  ['D. Tiến độ', 'Thêm / sửa mốc tiến độ', 'Cập nhật tiến độ', 'PM của HĐ + Admin', ...W],
  ['D. Tiến độ', 'Xóa mốc tiến độ', 'Xóa dòng tiến độ', 'PM của HĐ + Admin', ...W],

  // E. Công nợ phải thu
  ['E. Công nợ phải thu', 'Xem công nợ (lịch thu & tiền về)', 'Xem kế hoạch thu, đã thu, còn thiếu', 'Mọi user đăng nhập', ...V],
  ['E. Công nợ phải thu', 'Thêm / sửa lịch phải thu', 'Mốc thu, số tiền, ngày đến hạn', 'PM của HĐ + Admin', ...W],
  ['E. Công nợ phải thu', 'Ghi nhận thanh toán (tiền về)', 'Nhập khoản tiền khách đã trả', 'PM của HĐ + Admin', ...W],
  ['E. Công nợ phải thu', 'Sửa / xóa khoản thanh toán', 'Điều chỉnh khoản đã ghi', 'PM của HĐ + Admin', ...W],
  ['E. Công nợ phải thu', 'Xóa dòng công nợ', 'Xóa mốc phải thu', 'PM của HĐ + Admin', ...W],

  // F. Bảo lãnh
  ['F. Bảo lãnh', 'Xem bảo lãnh', 'Xem các bảo lãnh (tạm ứng, thực hiện…)', 'Mọi user đăng nhập', ...V],
  ['F. Bảo lãnh', 'Thêm / sửa bảo lãnh', 'Loại, giá trị, thời hạn', 'PM của HĐ + Admin', ...W],
  ['F. Bảo lãnh', 'Xóa bảo lãnh', 'Xóa dòng bảo lãnh', 'PM của HĐ + Admin', ...W],

  // G. Công việc
  ['G. Công việc', 'Xem danh sách công việc', 'Xem việc của HĐ', 'Mọi user đăng nhập', ...V],
  ['G. Công việc', 'Tạo công việc & giao việc', 'Tạo việc, gán người phụ trách', 'PM của HĐ + Admin', ...W],
  ['G. Công việc', 'Sửa công việc', 'Đổi người phụ trách, trạng thái, hạn', 'PM của HĐ + Admin', ...W],
  ['G. Công việc', 'Xóa công việc', 'Xóa việc', 'PM của HĐ + Admin', ...W],
  ['G. Công việc', 'Đính kèm / xóa file công việc', 'Upload, gỡ file đính kèm', 'PM của HĐ + Admin', ...W],
  ['G. Công việc', 'Tự cập nhật trạng thái / đánh dấu hoàn thành việc ĐƯỢC GIAO cho mình', 'Người được giao tự cập nhật tiến độ việc của mình', 'CHƯA hỗ trợ — hiện chỉ PM/Admin sửa được. KH cân nhắc CHO PHÉP người được giao (cột "Người được giao việc")', ...ADMIN_ONLY],
  ['G. Công việc', 'Tự đính kèm / gỡ file vào việc ĐƯỢC GIAO cho mình', 'Người được giao bổ sung minh chứng/file cho việc của mình', 'CHƯA hỗ trợ — hiện chỉ PM/Admin. KH cân nhắc CHO PHÉP người được giao', ...ADMIN_ONLY],

  // H. Bảo hành
  ['H. Bảo hành', 'Xem thiết bị / serial / case bảo hành', 'Tra cứu thiết bị, số serial, case', 'Mọi user đăng nhập', ...V],
  ['H. Bảo hành', 'Thêm / sửa thiết bị & serial', 'Quản lý danh mục thiết bị, serial', 'PM của HĐ + Admin', ...W],
  ['H. Bảo hành', 'Tạo / sửa case bảo hành', 'Mở & cập nhật case', 'PM của HĐ + Admin', ...W],
  ['H. Bảo hành', 'Ghi nhật ký xử lý bảo hành', 'Thêm hoạt động xử lý', 'PM của HĐ + Admin', ...W],
  ['H. Bảo hành', 'Xóa case / thiết bị / serial', 'Xóa dữ liệu bảo hành', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua (nhập) — Chung
  ['I. HĐ mua — Chung', 'Xem danh sách HĐ mua của HĐ bán', 'Liệt kê các HĐ mua/đặt hàng thuộc HĐ bán', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Chung', 'Tạo HĐ mua mới', 'Thêm HĐ mua/đặt hàng cho nhà cung cấp', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Chung', 'Sửa thông tin HĐ mua', 'Số HĐ mua, NCC, giá trị, điều khoản…', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Chung', 'Xóa HĐ mua', 'Xóa toàn bộ HĐ mua', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Tài liệu
  ['I. HĐ mua — Tài liệu', 'Xem tài liệu HĐ mua', 'Duyệt thư mục, tải xuống file', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Tài liệu', 'Quản lý thư mục / upload / xóa tài liệu', 'Tạo thư mục, tải lên, xóa file', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Bảng giá mua
  ['I. HĐ mua — Bảng giá mua', 'Xem bảng giá mua (BOQ mua)', 'Danh mục, đơn giá mua, thành tiền', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Bảng giá mua', 'Thêm / sửa / xóa dòng bảng giá mua', 'Hạng mục, khối lượng, đơn giá mua', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Bảng giá mua', 'Nhập bảng giá mua từ Excel (import)', 'Nạp hàng loạt từ file Excel', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Nhận hàng
  ['I. HĐ mua — Nhận hàng', 'Xem phiếu nhận hàng', 'Danh sách phiếu & hàng đã nhận', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Nhận hàng', 'Thêm / sửa / xóa phiếu nhận hàng & dòng hàng', 'Lập phiếu, nhập số lượng nhận', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Quản lý Serial
  ['I. HĐ mua — Quản lý Serial', 'Xem serial hàng nhận', 'Tra cứu serial theo phiếu nhận', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Quản lý Serial', 'Thêm / sửa / xóa serial', 'Gán, chỉnh, xóa số serial', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Thanh toán / Công nợ phải trả
  ['I. HĐ mua — Thanh toán', 'Xem công nợ phải trả & thanh toán', 'Lịch phải trả, đã trả NCC', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Thanh toán', 'Thêm / sửa lịch phải trả', 'Mốc phải trả, số tiền, ngày đến hạn', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Thanh toán', 'Ghi nhận thanh toán cho NCC', 'Nhập khoản đã trả nhà cung cấp', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Thanh toán', 'Sửa / xóa khoản thanh toán', 'Điều chỉnh khoản đã ghi', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Tiến độ theo BB
  ['I. HĐ mua — Tiến độ theo BB', 'Xem tiến độ theo biên bản', 'Các mốc nghiệm thu/biên bản', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Tiến độ theo BB', 'Thêm / sửa / xóa mốc tiến độ', 'Cập nhật tiến độ theo BB', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Bảo hành NCC
  ['I. HĐ mua — Bảo hành NCC', 'Xem bảo hành nhà cung cấp', 'Thông tin bảo hành từ NCC', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Bảo hành NCC', 'Thêm / sửa / xóa thông tin bảo hành NCC', 'Thời hạn, điều kiện bảo hành', 'PM của HĐ + Admin', ...W],
  ['I. HĐ mua — Bảo hành NCC', 'Tạo / xử lý yêu cầu bảo hành (claim)', 'Mở & cập nhật yêu cầu gửi NCC', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Bảo lãnh
  ['I. HĐ mua — Bảo lãnh', 'Xem bảo lãnh (mua)', 'Bảo lãnh tạm ứng/thực hiện từ NCC', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Bảo lãnh', 'Thêm / sửa / xóa bảo lãnh', 'Loại, giá trị, thời hạn', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Xuất nhập khẩu (Hải quan)
  ['I. HĐ mua — Xuất nhập khẩu', 'Xem hồ sơ hải quan / XNK', 'Tờ khai, chứng từ XNK', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Xuất nhập khẩu', 'Thêm / sửa / xóa hồ sơ hải quan', 'Cập nhật thông tin XNK', 'PM của HĐ + Admin', ...W],

  // I. HĐ mua — Logistics
  ['I. HĐ mua — Logistics', 'Xem theo dõi logistics', 'Trạng thái vận chuyển, lịch sử cập nhật', 'Mọi user đăng nhập', ...V],
  ['I. HĐ mua — Logistics', 'Thêm / sửa / xóa lô logistics & cập nhật trạng thái', 'Tạo lô vận chuyển, ghi cập nhật trạng thái', 'PM của HĐ + Admin', ...W],
]

const header = ['Nhóm chức năng', 'Chức năng / Thao tác', 'Mô tả', 'Hiện trạng hệ thống (tham chiếu)', ...ROLES, 'Người được giao việc', 'Quyền khách hàng yêu cầu (ghi chú)']
const aoa = [header, ...data.map(r => [...r, assigneeFor(r[0], r[1]), ''])]

const ws = XLSX.utils.aoa_to_sheet(aoa)
ws['!cols'] = [
  { wch: 28 }, { wch: 36 }, { wch: 44 }, { wch: 44 },
  ...ROLES.map(() => ({ wch: 13 })),
  { wch: 18 },
  { wch: 32 },
]
// Cố định hàng tiêu đề + 4 cột đầu khi cuộn
ws['!freeze'] = { xSplit: 4, ySplit: 1 }

// Sheet chú giải
const legend = [
  ['CHÚ GIẢI MA TRẬN PHÂN QUYỀN — MODULE HỢP ĐỒNG BÁN'],
  [''],
  ['Ký hiệu trong ô:'],
  ['✔', 'Vai trò ĐƯỢC PHÉP thực hiện thao tác đó'],
  ['(để trống)', 'Vai trò KHÔNG được phép'],
  [''],
  ['Giải thích các vai trò (cột):'],
  ['Admin', 'Quản trị hệ thống — toàn quyền mọi hợp đồng'],
  ['PM', 'Quản lý dự án của chính hợp đồng đó (PM chính + đồng PM)'],
  ['Kinh doanh', 'Nhân viên kinh doanh được gán vào hợp đồng'],
  ['Presale', 'Nhân sự presale được gán vào hợp đồng'],
  ['Kỹ thuật', 'Nhân sự kỹ thuật triển khai được gán vào hợp đồng'],
  ['Kế toán', 'Kế toán được gán vào hợp đồng'],
  ['Người theo dõi', 'Người được thêm để theo dõi hợp đồng'],
  ['User khác', 'User đã đăng nhập nhưng KHÔNG thuộc nhân sự hợp đồng'],
  ['Người được giao việc', 'Người được gán xử lý 1 công việc cụ thể (assignee) — có thể là bất kỳ ai, không phụ thuộc vai trò trong HĐ. Chỉ áp dụng cho phần "G. Công việc"; ô "—" nghĩa là không áp dụng.'],
  [''],
  ['Cách dùng:'],
  ['1.', 'Cột "Hiện trạng" mô tả hệ thống ĐANG cho phép ai (chỉ để tham chiếu).'],
  ['2.', 'Các ô vai trò đã điền sẵn theo hiện trạng — khách hàng chỉnh sửa (thêm/bớt ✔) theo mong muốn.'],
  ['3.', 'Cột cuối "Quyền khách hàng yêu cầu" để khách ghi chú điều kiện đặc biệt (vd: Kế toán chỉ sửa tab Công nợ).'],
  ['4.', 'Sau khi khách xác nhận, đội phát triển sẽ lập trình đúng theo ma trận này.'],
  [''],
  ['Ghi chú quan trọng:'],
  ['•', 'Hiện hệ thống chỉ phân quyền GHI ở 2 mức: PM-của-HĐ + Admin được ghi; còn lại chỉ XEM.'],
  ['•', 'Nếu khách muốn phân quyền chi tiết theo từng vai trò × từng tab (vd Kỹ thuật được sửa Tiến độ/Bảo hành, Kế toán sửa Công nợ), đội phát triển sẽ bổ sung cơ chế phân quyền theo vai trò.'],
  ['•', 'Quyền XEM hiện mở cho mọi user đăng nhập; nếu cần giới hạn chỉ người thuộc HĐ được xem, vui lòng nêu rõ.'],
  ['•', 'NGƯỜI ĐƯỢC GIAO VIỆC: hiện nếu không phải PM thì KHÔNG tự cập nhật/đánh dấu hoàn thành việc của mình được (chỉ PM/Admin sửa). Đây thường là điểm khách muốn thay đổi — đánh dấu ✔ ở cột "Người được giao việc" nếu muốn cho phép.'],
]
const wsL = XLSX.utils.aoa_to_sheet(legend)
wsL['!cols'] = [{ wch: 14 }, { wch: 92 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Ma trận phân quyền')
XLSX.utils.book_append_sheet(wb, wsL, 'Chú giải')

const out = path.join(__dirname, '..', 'docs', 'Ma-tran-phan-quyen-HD-ban.xlsx')
XLSX.writeFile(wb, out)
console.log('Đã tạo:', out, '—', data.length, 'chức năng')
