import { pool } from '../db.js'

// Helper "as-of snapshot": dựng lại phiên bản của từng hàng tại 1 thời điểm quá khứ
// từ bảng record_history (migration 062). Dùng cho Dashboard "Xem tại 1 thời điểm".

// Map(String(row_id) → data jsonb) = phiên bản hiệu lực tại asOf của 1 bảng theo dõi.
// Lấy bản ghi mới nhất có valid_from ≤ asOf (so theo ngày, múi giờ VN — nhất quán với
// cách event hiện dùng `payment_date <= asOf`); bỏ hàng mà bản mới nhất là DELETE.
export async function asOfSnapshot(tableName, asOf, db = pool) {
  const { rows } = await db.query(`
    SELECT DISTINCT ON (row_id) row_id, op, data
      FROM public.record_history
     WHERE table_name = $1
       AND (valid_from AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= $2::date
     ORDER BY row_id, valid_from DESC, id DESC`, [tableName, asOf])
  const map = new Map()
  for (const r of rows) {
    if (r.op === 'D') continue        // hàng đã xóa tính tới asOf
    map.set(String(r.row_id), r.data)
  }
  return map
}
