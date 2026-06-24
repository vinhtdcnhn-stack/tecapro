import { pool } from '../db.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tổng quan Đấu thầu cho Dashboard điều hành (BGĐ). Khác /tender/reports (gác
// isTenderMember) — endpoint này gác requireAccountant nên Ban Giám đốc xem được.
//   • active   : gói đang theo dõi (chưa có kết quả, chưa hủy) + dự toán quy VNĐ.
//   • winrate  : tỷ lệ trúng = Trúng / (Trúng + Trượt) trong kỳ (theo submit_date).
//   • won      : giá trị (dự toán quy VNĐ) các gói đã Trúng trong kỳ.
//   • upcoming : gói có submit_date trong 7 ngày tới & chưa có kết quả (cảnh báo).
// Dự toán lưu NGUYÊN TỆ → luôn quy VNĐ bằng estimate * COALESCE(exchange_rate, 1).
// ──────────────────────────────────────────────────────────────────────────────

const VND = 'estimate * COALESCE(exchange_rate, 1)'

// Khoảng lọc theo submit_date (from/to, tham số hoá) áp cho winrate/won.
function periodWhere(from, to, params) {
  const conds = ['is_deleted = false']
  if (from) { params.push(from); conds.push(`submit_date >= $${params.length}`) }
  if (to) { params.push(to); conds.push(`submit_date <= $${params.length}`) }
  return conds.join(' AND ')
}

export async function getTenderOverview(req, res) {
  const from = String(req.query?.from ?? '').trim() || null
  const to = String(req.query?.to ?? '').trim() || null
  // Mốc "hôm nay" cho gói đang theo dõi / sắp đến hạn (xem lại quá khứ dùng asOf).
  const asOf = String(req.query?.asOf ?? '').trim() || null

  const rowCols = `id, package_name, investor, ${VND} AS estimate_vnd,
                   submit_date, workflow_status, result`
  try {
    // ── Gói đang theo dõi: chưa có kết quả & chưa hủy, đã nộp tới mốc xem (hoặc chưa nộp) ──
    const pa = []
    const asOfCond = asOf ? (pa.push(asOf), `(submit_date IS NULL OR submit_date <= $${pa.length})`) : 'TRUE'
    const { rows: activeRows } = await pool.query(
      `SELECT ${rowCols} FROM tender
        WHERE is_deleted = false AND result IS NULL
          AND workflow_status <> 'Có kết quả' AND ${asOfCond}
        ORDER BY submit_date NULLS LAST`, pa)
    const active = {
      count: activeRows.length,
      estimate_vnd: activeRows.reduce((s, r) => s + Number(r.estimate_vnd || 0), 0),
      rows: activeRows,
    }

    // ── Tỷ lệ trúng + danh sách gói đã có kết quả trong kỳ ──
    const pw = []; const ww = periodWhere(from, to, pw)
    const { rows: concluded } = await pool.query(
      `SELECT ${rowCols} FROM tender
        WHERE ${ww} AND result IN ('Trúng', 'Trượt')
        ORDER BY submit_date DESC NULLS LAST`, pw)
    const won = concluded.filter(r => r.result === 'Trúng')
    const lost = concluded.filter(r => r.result === 'Trượt')
    const denom = won.length + lost.length
    const winrate = {
      won: won.length, lost: lost.length,
      rate: denom ? Math.round((won.length / denom) * 100) : 0,
      rows: concluded,
    }

    // ── Giá trị trúng thầu trong kỳ (dự toán quy VNĐ các gói Trúng) ──
    const wonValue = {
      count: won.length,
      estimate_vnd: won.reduce((s, r) => s + Number(r.estimate_vnd || 0), 0),
      rows: won,
    }

    // ── Gói sắp đến hạn nộp: submit_date trong [mốc, mốc+7 ngày] & chưa có kết quả ──
    const base = asOf ? `$1::date` : `CURRENT_DATE`
    const pu = asOf ? [asOf] : []
    const { rows: upRows } = await pool.query(
      `SELECT ${rowCols}, (submit_date - ${base}) AS days_left FROM tender
        WHERE is_deleted = false AND result IS NULL AND submit_date IS NOT NULL
          AND submit_date >= ${base} AND submit_date <= ${base} + INTERVAL '7 days'
        ORDER BY submit_date`, pu)
    const upcoming = { count: upRows.length, rows: upRows }

    res.json({ active, winrate, won: wonValue, upcoming })
  } catch (err) {
    console.error('getTenderOverview:', err)
    res.status(500).json({ error: 'Không thể tải tổng quan đấu thầu.' })
  }
}
