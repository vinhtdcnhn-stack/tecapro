import { pool } from '../db.js'

// ── Chống 2 người ghi đè nhau (optimistic locking) ────────────────────────────
// Vấn đề: A và B cùng mở một dòng; A lưu trước, B lưu sau → bản của A bị đè mất
// mà không ai hay biết. Cách chặn: client gửi kèm mốc `_updatedAt` trong body PUT
// (chính là updated_at của dòng LÚC HỌ TẢI VỀ); trước khi UPDATE, so mốc đó với
// updated_at hiện tại trong DB — lệch nghĩa là có người đã lưu chen giữa → trả
// 409 kèm cờ `conflict: true`, KHÔNG ghi đè. FE bắt cờ này để báo + tải lại bảng
// (xem src/components/contracts/conflict.js — hai file này đi cặp với nhau).
//
// Tương thích ngược: client không gửi _updatedAt (màn hình chưa nối, gọi API tay)
// → bỏ qua kiểm tra, hành vi y như trước. So sánh theo mili-giây epoch để không
// phụ thuộc định dạng chuỗi hay múi giờ (timestamp lẫn timestamptz đều được pg
// driver parse thành Date; client chỉ echo lại đúng chuỗi JSON đã nhận).
//
// Cờ `conflict: true` là để FE phân biệt với 409 nghiệp vụ khác (vd trùng tên
// hàng ở BOQ nhập). `table` luôn là hằng chuỗi do controller truyền — không nhận
// từ client nên không có rủi ro SQL injection.
//
// Trả về true nếu ĐÃ trả lời 409 (controller phải return ngay); false nếu đi tiếp.
export async function rejectIfStale(req, res, table, idParam = 'id') {
  const stamp = req.body?._updatedAt
  if (!stamp) return false
  const clientMs = new Date(stamp).getTime()
  if (!Number.isFinite(clientMs)) return false // mốc rác → coi như không gửi

  const { rows } = await pool.query(
    `SELECT updated_at FROM ${table} WHERE id = $1`,
    [req.params[idParam]]
  )
  // Không có dòng / chưa từng có updated_at → để controller xử lý (404) như cũ.
  if (!rows.length || !rows[0].updated_at) return false
  if (new Date(rows[0].updated_at).getTime() === clientMs) return false

  res.status(409).json({
    conflict: true,
    error: 'Dòng này vừa được người khác sửa trong lúc bạn đang nhập. ' +
           'Bảng sẽ tải lại dữ liệu mới nhất — kiểm tra lại rồi sửa tiếp nếu cần.',
  })
  return true
}
