import { pool } from '../db.js'
import { logActivity } from './tenderController.js'
import { roundMoney } from '../utils/money.js'
import { cacheWrap } from '../cache.js'
import { tenderKey, tenderTabNotModified, invalidateTender, invalidateTenderList, invalidateReports } from '../services/cacheKeys.js'

const LOTS_TTL = 5 * 60 // 5'

// Lô đổi → tab lots + dự toán gói (info + danh sách + báo cáo đấu thầu, do syncTenderEstimate).
function invalidateLot(tenderId) {
  invalidateTender(tenderId, 'lots', 'info')
  invalidateTenderList()
  invalidateReports('tender')
}

// ──────────────────────────────────────────────────────────────────────────────
// Lô/phần của gói thầu + nhà thầu dự thầu (module Ban Đấu thầu, dept 9).
//   • Lô: mỗi gói có 1..n lô, mỗi lô có dự toán + kết quả Trúng/Trượt riêng.
//   • Nhà thầu: gắn theo lô; xếp hạng giá tính lúc đọc (RANK trong từng lô).
// Danh tính luôn lấy từ req.user. Tiền lưu nguyên tệ của gói (làm tròn theo tiền tệ gói).
// ──────────────────────────────────────────────────────────────────────────────

const LOT_RESULTS = new Set(['Trúng', 'Trượt', 'Hủy'])
const TECH_RESULTS = new Set(['Đạt', 'Trượt'])

const str = (v) => { const s = String(v ?? '').trim(); return s || null }
const num = (v) => { const n = Number(v); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null }

// Tiền tệ của gói (để làm tròn dự toán/giá theo nguyên tệ). VND mặc định nếu không có.
async function tenderCurrency(tenderId) {
  const { rows } = await pool.query('SELECT currency_code FROM tender WHERE id = $1', [tenderId])
  return rows[0]?.currency_code || 'VND'
}

// Tra ngược gói chứa lô (cho rounding + audit + 404).
async function tenderIdOfLot(lotId) {
  const { rows } = await pool.query('SELECT tender_id FROM tender_lot WHERE id = $1', [lotId])
  return rows[0]?.tender_id ?? null
}

// Khi gói CÓ lô: dự toán gói = TỔNG dự toán các lô (cùng tiền tệ gói) — tự đồng bộ
// sau mỗi lần thêm/sửa/xoá lô. Gói không còn lô nào → giữ nguyên dự toán nhập tay.
async function syncTenderEstimate(tenderId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt, SUM(estimate) AS total FROM tender_lot WHERE tender_id = $1',
    [tenderId],
  )
  if (rows[0].cnt === 0) return
  await pool.query('UPDATE tender SET estimate = $1, updated_at = now() WHERE id = $2',
    [rows[0].total, tenderId])
}

// Tra ngược gói + lô chứa nhà thầu.
async function lotAndTenderOfBidder(bidderId) {
  const { rows } = await pool.query(
    `SELECT b.lot_id, l.tender_id
       FROM tender_bidder b JOIN tender_lot l ON l.id = b.lot_id
      WHERE b.id = $1`, [bidderId])
  return rows[0] || null
}

// ── Đọc: các lô của gói + nhà thầu lồng trong mỗi lô (kèm hạng giá theo lô) ────
export async function getLots(req, res) {
  const tenderId = parseInt(req.params.id)
  try {
    if (await tenderTabNotModified(req, res, tenderId, 'lots')) return
    const out = await cacheWrap(tenderKey(tenderId, 'lots'), LOTS_TTL, async () => {
    const { rows: lots } = await pool.query(
      `SELECT id, tender_id, lot_name, lot_code, estimate, result, sort_order, note
         FROM tender_lot WHERE tender_id = $1
        ORDER BY sort_order ASC, id ASC`,
      [tenderId],
    )
    const { rows: bidders } = await pool.query(
      `SELECT b.id, b.lot_id, b.bidder_name, b.bid_price, b.is_self, b.tech_result, b.note,
              CASE WHEN b.bid_price IS NOT NULL
                   THEN RANK() OVER (PARTITION BY b.lot_id ORDER BY b.bid_price ASC) END AS price_rank
         FROM tender_bidder b
         JOIN tender_lot l ON l.id = b.lot_id
        WHERE l.tender_id = $1
        ORDER BY b.bid_price ASC NULLS LAST, b.id ASC`,
      [tenderId],
    )
    const byLot = new Map()
    for (const b of bidders) {
      const k = String(b.lot_id)
      if (!byLot.has(k)) byLot.set(k, [])
      byLot.get(k).push(b)
    }
    return lots.map(l => ({ ...l, bidders: byLot.get(String(l.id)) || [] }))
    })
    res.json(out)
  } catch (err) {
    console.error('getLots:', err)
    res.status(500).json({ error: 'Không thể tải danh sách lô.' })
  }
}

// ── Lô ────────────────────────────────────────────────────────────────────────
export async function createLot(req, res) {
  const tenderId = parseInt(req.params.id)
  const name = str(req.body?.lot_name)
  if (!name) return res.status(400).json({ error: 'Tên lô không được để trống.' })
  const result = str(req.body?.result)
  try {
    const ccy = await tenderCurrency(tenderId)
    const estimate = num(req.body?.estimate)
    const { rows } = await pool.query(
      `INSERT INTO tender_lot (tender_id, lot_name, lot_code, estimate, result, sort_order, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [tenderId, name, str(req.body?.lot_code), estimate != null ? roundMoney(estimate, ccy) : null,
        result && LOT_RESULTS.has(result) ? result : null, num(req.body?.sort_order) ?? 0,
        str(req.body?.note)],
    )
    await syncTenderEstimate(tenderId)
    invalidateLot(tenderId)
    logActivity(tenderId, req.user.id, 'lot', `Thêm lô "${name}"`)
    res.status(201).json({ success: true, id: rows[0].id })
  } catch (err) {
    console.error('createLot:', err)
    res.status(500).json({ error: 'Không thể thêm lô.' })
  }
}

export async function updateLot(req, res) {
  const lotId = parseInt(req.params.lotId)
  const name = str(req.body?.lot_name)
  if (!name) return res.status(400).json({ error: 'Tên lô không được để trống.' })
  const result = str(req.body?.result)
  try {
    const tenderId = await tenderIdOfLot(lotId)
    if (!tenderId) return res.status(404).json({ error: 'Không tìm thấy lô.' })
    const ccy = await tenderCurrency(tenderId)
    const estimate = num(req.body?.estimate)
    await pool.query(
      `UPDATE tender_lot SET lot_name=$1, lot_code=$2, estimate=$3, result=$4,
         sort_order=$5, note=$6, updated_at=now() WHERE id=$7`,
      [name, str(req.body?.lot_code), estimate != null ? roundMoney(estimate, ccy) : null,
        result && LOT_RESULTS.has(result) ? result : null, num(req.body?.sort_order) ?? 0,
        str(req.body?.note), lotId],
    )
    await syncTenderEstimate(tenderId)
    invalidateLot(tenderId)
    logActivity(tenderId, req.user.id, 'lot', `Cập nhật lô "${name}"`)
    res.json({ success: true, id: lotId })
  } catch (err) {
    console.error('updateLot:', err)
    res.status(500).json({ error: 'Không thể cập nhật lô.' })
  }
}

export async function deleteLot(req, res) {
  const lotId = parseInt(req.params.lotId)
  try {
    const tenderId = await tenderIdOfLot(lotId)
    if (!tenderId) return res.status(404).json({ error: 'Không tìm thấy lô.' })
    await pool.query('DELETE FROM tender_lot WHERE id = $1', [lotId])
    await syncTenderEstimate(tenderId)
    invalidateLot(tenderId)
    logActivity(tenderId, req.user.id, 'lot', `Xoá lô #${lotId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteLot:', err)
    res.status(500).json({ error: 'Không thể xoá lô.' })
  }
}

// ── Nhà thầu trong lô ──────────────────────────────────────────────────────────
// Chuẩn hoá body nhà thầu → giá trị insert/update (giá làm tròn theo tiền tệ gói).
function readBidder(b, ccy) {
  const tech = str(b.tech_result)
  const price = num(b.bid_price)
  return {
    bidder_name: str(b.bidder_name),
    bid_price: price != null ? roundMoney(price, ccy) : null,
    is_self: b.is_self === true || b.is_self === 'true',
    tech_result: tech && TECH_RESULTS.has(tech) ? tech : null,
    note: str(b.note),
  }
}

// Khi đánh dấu 1 đơn vị là "của tôi" → bỏ cờ self ở các đơn vị khác CÙNG LÔ (tránh
// vi phạm unique index uq_tender_bidder_self). exceptId: dòng đang giữ cờ (update).
async function clearSelf(client, lotId, exceptId = null) {
  await client.query(
    `UPDATE tender_bidder SET is_self = false, updated_at = now()
      WHERE lot_id = $1 AND is_self = true AND ($2::bigint IS NULL OR id <> $2)`,
    [lotId, exceptId],
  )
}

export async function createBidder(req, res) {
  const lotId = parseInt(req.params.lotId)
  const tenderId = await tenderIdOfLot(lotId)
  if (!tenderId) return res.status(404).json({ error: 'Không tìm thấy lô.' })
  const ccy = await tenderCurrency(tenderId)
  const v = readBidder(req.body, ccy)
  if (!v.bidder_name) return res.status(400).json({ error: 'Tên đơn vị không được để trống.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (v.is_self) await clearSelf(client, lotId)
    const { rows } = await client.query(
      `INSERT INTO tender_bidder (lot_id, bidder_name, bid_price, is_self, tech_result, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [lotId, v.bidder_name, v.bid_price, v.is_self, v.tech_result, v.note],
    )
    await client.query('COMMIT')
    invalidateTender(tenderId, 'lots')
    logActivity(tenderId, req.user.id, 'bidder', `Thêm nhà thầu "${v.bidder_name}"`)
    res.status(201).json({ success: true, id: rows[0].id })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('createBidder:', err)
    res.status(500).json({ error: 'Không thể thêm nhà thầu.' })
  } finally {
    client.release()
  }
}

export async function updateBidder(req, res) {
  const bidderId = parseInt(req.params.bidderId)
  const ref = await lotAndTenderOfBidder(bidderId)
  if (!ref) return res.status(404).json({ error: 'Không tìm thấy nhà thầu.' })
  const ccy = await tenderCurrency(ref.tender_id)
  const v = readBidder(req.body, ccy)
  if (!v.bidder_name) return res.status(400).json({ error: 'Tên đơn vị không được để trống.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (v.is_self) await clearSelf(client, ref.lot_id, bidderId)
    await client.query(
      `UPDATE tender_bidder SET bidder_name=$1, bid_price=$2, is_self=$3, tech_result=$4,
         note=$5, updated_at=now() WHERE id=$6`,
      [v.bidder_name, v.bid_price, v.is_self, v.tech_result, v.note, bidderId],
    )
    await client.query('COMMIT')
    invalidateTender(ref.tender_id, 'lots')
    logActivity(ref.tender_id, req.user.id, 'bidder', `Cập nhật nhà thầu "${v.bidder_name}"`)
    res.json({ success: true, id: bidderId })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('updateBidder:', err)
    res.status(500).json({ error: 'Không thể cập nhật nhà thầu.' })
  } finally {
    client.release()
  }
}

export async function deleteBidder(req, res) {
  const bidderId = parseInt(req.params.bidderId)
  try {
    const ref = await lotAndTenderOfBidder(bidderId)
    if (!ref) return res.status(404).json({ error: 'Không tìm thấy nhà thầu.' })
    await pool.query('DELETE FROM tender_bidder WHERE id = $1', [bidderId])
    invalidateTender(ref.tender_id, 'lots')
    logActivity(ref.tender_id, req.user.id, 'bidder', `Xoá nhà thầu #${bidderId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteBidder:', err)
    res.status(500).json({ error: 'Không thể xoá nhà thầu.' })
  }
}
