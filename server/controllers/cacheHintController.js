import { pool } from '../db.js'
import { snapshotHints, resetHints } from '../middleware/cacheHint.js'
import { isCacheReady, flushCache } from '../cache.js'
import { verifyUserPassword } from '../auth/verifyPassword.js'

// ──────────────────────────────────────────────────────────────────────────────
// Chẩn đoán hiệu năng (CHỈ ADMIN, read-only). Hai lớp:
//   ① Route đọc nóng & chậm & chưa cache — từ middleware cacheHint (in-memory).
//   ② Câu truy vấn đắt nhất — từ pg_stat_statements (nếu extension đã bật).
// Trang chỉ để XEM và quyết định chỗ nào đáng bọc cache; không tự cache gì.
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/admin/cache-hints?minP95=&minCount=
export async function getCacheHints(req, res) {
  const minP95 = Math.max(1, Number(req.query.minP95) || 80)
  const minCount = Math.max(1, Number(req.query.minCount) || 50)
  const snap = snapshotHints({ minP95, minCount })
  res.json({ cacheReady: isCacheReady(), ...snap })
}

// POST /api/admin/cache-hints/reset — xóa bộ đếm in-memory, đo lại từ đầu.
export function postResetCacheHints(_req, res) {
  resetHints()
  res.json({ ok: true })
}

// POST /api/admin/cache/flush — XÓA TOÀN BỘ cache Redis (thao tác nhạy cảm). Buộc admin
// nhập lại mật khẩu của chính mình để xác nhận. Sau khi xóa, mọi API đọc sẽ nạp lại từ DB.
export async function postFlushCache(req, res) {
  const ok = await verifyUserPassword(req.user.id, req.body?.password)
  if (!ok) return res.status(401).json({ error: 'Mật khẩu không đúng.' })
  try {
    const cleared = await flushCache()
    res.json({ ok: true, cleared })
  } catch (err) {
    res.status(409).json({ error: err.message || 'Không xóa được cache.' })
  }
}

// GET /api/admin/slow-queries?limit=  — top query đọc đắt nhất theo tổng thời gian thực thi.
// pg_stat_statements là extension tùy chọn; nếu chưa cài/bật thì trả available:false kèm
// hướng dẫn thay vì để trang vỡ.
export async function getSlowQueries(req, res) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30))
  try {
    const { rows } = await pool.query(
      `SELECT query,
              calls,
              round(total_exec_time)::bigint      AS total_ms,
              round(mean_exec_time::numeric, 2)   AS mean_ms,
              rows
         FROM pg_stat_statements
        WHERE query ILIKE 'SELECT%'
        ORDER BY total_exec_time DESC
        LIMIT $1`,
      [limit],
    )
    res.json({ available: true, rows })
  } catch (err) {
    // 42P01 = relation không tồn tại (chưa CREATE EXTENSION); 42883/0A000 = chưa nạp thư viện.
    if (['42P01', '42883', '0A000'].includes(err.code)) {
      res.json({
        available: false,
        hint: "pg_stat_statements chưa bật. Trên VPS: thêm 'pg_stat_statements' vào shared_preload_libraries (postgresql.conf), restart Postgres, rồi CREATE EXTENSION pg_stat_statements;",
      })
      return
    }
    console.error('getSlowQueries:', err)
    res.status(500).json({ error: 'Không thể đọc pg_stat_statements' })
  }
}
