import { EventEmitter } from 'events'

// Bus sự kiện TRONG TIẾN TRÌNH cho cơ chế long-poll (app chạy 1 instance Express).
// Mỗi khi có dữ liệu mới ảnh hưởng tới badge/cảnh báo (mục dòng thời gian công việc HĐ,
// báo cáo/chỉ đạo việc phòng, đơn đề xuất đổi trạng thái), controller gọi bumpLive().
// Các request long-poll đang "treo" trong liveController nghe sự kiện này để thức dậy,
// tính lại số liệu của riêng người dùng và trả về NGAY khi có thay đổi.
//
// Vì là EventEmitter trong RAM của 1 tiến trình, cơ chế này chỉ đúng khi chạy đơn
// instance. Nếu sau này scale nhiều tiến trình/máy, thay bằng Postgres LISTEN/NOTIFY
// hoặc Redis pub/sub (giữ nguyên API bumpLive/onLiveChange ở đây).
const bus = new EventEmitter()
// Nhiều người dùng cùng treo long-poll → nhiều listener trên cùng 1 event. Nới trần
// để Node không cảnh báo nhầm "possible memory leak".
bus.setMaxListeners(0)

const EVENT = 'live-change'

// Bộ đếm phiên bản tăng đơn điệu: tiện cho debug/log, không bắt buộc cho logic.
let version = 0

// Gọi sau khi GHI thành công dữ liệu có thể đổi số liệu cảnh báo của ai đó.
// tag chỉ để ghi log/chẩn đoán; mọi waiter đều thức dậy và tự tính lại phần của mình.
export function bumpLive(tag = 'change') {
  version++
  bus.emit(EVENT, { tag, version })
}

// Đăng ký nghe một lần sự kiện thay đổi. Trả về hàm hủy đăng ký.
export function onLiveChange(fn) {
  bus.on(EVENT, fn)
  return () => bus.off(EVENT, fn)
}

export function liveVersion() {
  return version
}
