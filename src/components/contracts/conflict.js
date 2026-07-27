// Chống 2 người ghi đè nhau — đi cặp với server/utils/staleGuard.js.
//
// withStamp(body, row): gắn mốc `_updatedAt` (updated_at của dòng LÚC TẢI VỀ) vào
// body PUT; server so mốc này với DB để phát hiện có người lưu chen giữa. Dòng mới
// (_isNew) hoặc dòng không có updated_at thì gửi nguyên body — server bỏ qua kiểm tra.
//
// handledConflict(res, data, reload): nếu response là 409 xung đột (cờ conflict từ
// staleGuard — phân biệt với 409 nghiệp vụ khác như trùng tên hàng) → báo người dùng
// + tải lại bảng để lấy bản mới nhất (gồm cả sửa đổi của người kia), trả true để
// saveRow dừng. LƯU Ý: reload thay toàn bộ rows nên dòng khác đang sửa dở cũng bị
// nạp lại — chấp nhận vì xung đột hiếm và dữ liệu nền lúc đó đã cũ.
export const withStamp = (body, row) =>
  (!row._isNew && row.updated_at) ? { ...body, _updatedAt: row.updated_at } : body

export async function handledConflict(res, data, reload) {
  if (res.status !== 409 || !data?.conflict) return false
  alert(data.error || 'Dòng này vừa được người khác sửa. Bảng sẽ tải lại dữ liệu mới nhất.')
  try { await reload?.() } catch { /* tải lại lỗi → người dùng có thể bấm F5 */ }
  return true
}
