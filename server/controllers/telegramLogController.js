import { pool } from '../db.js'

// Số ngày giữ nhật ký gửi Telegram. Quá hạn này tự xóa (job định kỳ + dọn khi tải trang).
const RETENTION_DAYS = 3
const MAX_PAGE_SIZE = 100

// Xóa các bản ghi quá hạn lưu. Fire-and-forget, tự nuốt lỗi.
export async function purgeOldTelegramLogs() {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM telegram_send_log WHERE created_at < now() - make_interval(days => $1)`,
      [RETENTION_DAYS],
    )
    return rowCount
  } catch (err) {
    console.error('purgeOldTelegramLogs:', err)
    return 0
  }
}

// GET /api/telegram-logs?page=1&pageSize=50  — chỉ admin.
// Trả về { items, total, page, pageSize } để frontend phân trang / tải dần.
export async function listTelegramLogs(req, res) {
  // Dọn log cũ trước khi đọc để bảng luôn chỉ còn dữ liệu ≤ 3 ngày.
  await purgeOldTelegramLogs()

  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))
  const offset = (page - 1) * pageSize

  try {
    const { rows } = await pool.query(
      `SELECT id, chat_id, message, ok, error, http_status, created_at
         FROM telegram_send_log
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    )
    const { rows: cnt } = await pool.query('SELECT count(*)::int AS total FROM telegram_send_log')
    res.json({ items: rows, total: cnt[0].total, page, pageSize })
  } catch (err) {
    console.error('listTelegramLogs:', err)
    res.status(500).json({ error: 'Không tải được nhật ký gửi Telegram.' })
  }
}
