// Sinh file Excel mô tả toàn bộ thông báo Telegram của hệ thống.
// Chạy: node scripts/genTelegramNotifyTable.js
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Bản ESM của SheetJS không tự gắn fs → phải set thủ công để writeFile ghi ra đĩa.
XLSX.set_fs(fs)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ACTION = '🔔 Cần xử lý (in đậm + chuông)'
const INFO = 'Thông tin (chữ thường)'

// [Nhóm, Sự kiện (khi nào gửi), Người nhận, Loại tin, Nội dung mẫu]
const rows = [
  // Phê duyệt
  ['Phê duyệt', 'Gửi đơn đề xuất', 'Người duyệt bước đầu tiên', ACTION, 'Bạn có đơn cần duyệt: {tiêu đề đơn}'],
  ['Phê duyệt', 'Duyệt 1 bước & chuyển bước kế', 'Người duyệt bước tiếp theo', ACTION, 'Bạn có đơn cần duyệt: {tiêu đề đơn}'],
  ['Phê duyệt', 'Đơn được duyệt xong toàn bộ', 'Người gửi đơn', INFO, 'Đơn của bạn đã được duyệt xong: {tiêu đề đơn}'],
  ['Phê duyệt', 'Đơn bị từ chối', 'Người gửi đơn', INFO, 'Đơn của bạn bị từ chối ở bước "{tên bước}": {tiêu đề đơn}\\nLý do: ...'],

  // Công việc phòng (KT Cơ điện)
  ['Công việc phòng', 'Giao công việc mới', 'Người được giao việc', ACTION, '{người giao} giao cho bạn công việc mới:\\n{tên việc}'],
  ['Công việc phòng', 'Yêu cầu chuyển việc', 'Người được đề nghị nhận việc', ACTION, '{người chuyển} muốn chuyển việc cho bạn:\\n{tên việc}\\nVui lòng chấp nhận hoặc từ chối.'],
  ['Công việc phòng', 'Chấp nhận việc được chuyển', 'Người giữ việc cũ + người giao gốc', INFO, '{người nhận} đã CHẤP NHẬN việc được chuyển:\\n{tên việc}'],
  ['Công việc phòng', 'Từ chối việc được chuyển', 'Người giữ việc cũ + người giao gốc', INFO, '{người nhận} đã TỪ CHỐI việc được chuyển:\\n{tên việc}'],
  ['Công việc phòng', 'Đẩy việc lên cấp trên', 'Trưởng/phó phòng KT Cơ điện', ACTION, '{người đẩy} ĐẨY CẤP TRÊN công việc:\\n{tên việc}\\nLý do: ...'],
  ['Công việc phòng', 'Báo vấn đề khi triển khai', 'Người tạo việc + trưởng/phó phòng', ACTION, '{người báo} báo vấn đề ở công việc:\\n{tên việc}\\n{nội dung vấn đề}'],

  // Đăng nhập
  ['Đăng nhập', 'Tài khoản vừa đăng nhập hệ thống', 'Chính chủ tài khoản', INFO, '🔐 Tài khoản của bạn vừa đăng nhập vào hệ thống TECAPRO lúc {thời gian}.'],

  // Công việc hợp đồng
  ['Công việc hợp đồng', 'Tạo việc có người phụ trách', 'Người được giao việc', ACTION, 'Bạn được giao công việc mới: "{tên việc}" — HĐ {số HĐ}\\nHạn: {dd/mm/yyyy}'],
  ['Công việc hợp đồng', 'Đổi người phụ trách', 'Người phụ trách mới', ACTION, 'Bạn được giao công việc: "{tên việc}" — HĐ {số HĐ}\\nHạn: {dd/mm/yyyy}'],
  ['Công việc hợp đồng', 'Đổi trạng thái công việc', 'Người tạo việc', INFO, 'Công việc "{tên việc}" (HĐ {số HĐ}) đã chuyển sang trạng thái: {trạng thái}'],

  // Thành viên hợp đồng
  ['Thành viên hợp đồng', 'Được phân công làm PM (khi tạo/sửa HĐ)', 'PM được thêm', ACTION, 'Bạn được phân công làm PM chủ trì hợp đồng {số HĐ}'],
  ['Thành viên hợp đồng', 'Được thêm vai trò khác (Kinh doanh/Presale/Kỹ thuật/Kế toán/Theo dõi)', 'Thành viên được thêm', INFO, 'Bạn được thêm vào hợp đồng {số HĐ} với vai trò: {vai trò}'],

  // Công nợ thu
  ['Công nợ thu', 'Ghi nhận một khoản tiền về', 'PM hợp đồng', INFO, 'HĐ {số HĐ} vừa ghi nhận thanh toán {số tiền} {loại tiền} ngày {dd/mm/yyyy}.'],

  // Bảo hành
  ['Bảo hành', 'Tạo case bảo hành mới', 'PM hợp đồng', ACTION, 'Có case bảo hành mới cần xử lý ở HĐ {số HĐ}: "{tiêu đề case}"'],

  // Nhắc theo lịch
  ['Nhắc theo lịch (08:15 & 13:45 giờ VN, T2–T6)', 'Công việc hợp đồng đến hạn / quá hạn (chưa hoàn thành)', 'Người phụ trách việc', ACTION, 'Bạn có công việc cần xử lý:\\n• "{tên việc}" (HĐ {số HĐ}) — QUÁ HẠN/đến hạn hôm nay {dd/mm}'],
  ['Nhắc theo lịch (08:15 & 13:45 giờ VN, T2–T6)', 'Công nợ phải thu đến hạn (hợp đồng còn nợ)', 'PM hợp đồng', ACTION, 'Công nợ cần theo dõi thu:\\n• HĐ {số HĐ}: {mô tả} — {số tiền} {loại tiền} (hạn {dd/mm/yyyy})'],
]

const header = ['Nhóm chức năng', 'Sự kiện (khi nào gửi)', 'Người nhận', 'Loại tin', 'Nội dung mẫu']
const note = [
  ['GHI CHÚ:'],
  ['• Người chưa đăng ký Telegram ID (app_user.telegram_chat_id) sẽ KHÔNG nhận bất kỳ thông báo nào.'],
  ['• "Cần xử lý" = gửi in đậm toàn dòng kèm biểu tượng chuông 🔔. "Thông tin" = chữ thường.'],
  ['• Hệ thống không tự gửi cho chính người vừa thao tác (vd tự nhận việc của mình).'],
  ['• Nhắc theo lịch chạy 08:15 và 13:45 giờ Việt Nam, chỉ thứ 2 đến thứ 6.'],
]

const aoa = [header, ...rows, [], ...note]
const ws = XLSX.utils.aoa_to_sheet(aoa)
ws['!cols'] = [{ wch: 30 }, { wch: 42 }, { wch: 34 }, { wch: 30 }, { wch: 70 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Thông báo Telegram')

const out = path.join(__dirname, '..', 'docs', 'Bang-thong-bao-Telegram.xlsx')
XLSX.writeFile(wb, out)
console.log('Đã tạo:', out, '—', rows.length, 'sự kiện')
