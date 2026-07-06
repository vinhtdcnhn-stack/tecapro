import { pool } from '../db.js'
import { invalidateContractIn, invalidateContract } from '../services/cacheKeys.js'
import { computeCoverage } from './supplyCoverageHelpers.js'

// Phía HĐ NHẬP: cột "Nhập cho" trong tab Bảng giá mua.
//  - getSupplyTargets: danh sách [hàng bán › đầu bán] để chọn — THEO HĐ bán đang xem
//    (context-scoped): đứng ở HĐ bán nào thì chỉ chọn nhập cho hàng bán của HĐ bán đó.
//  - setLinksForInBoqRow: gán/xóa ghép cho 1 dòng bảng giá nhập, PHẠM VI 1 HĐ bán (giữ
//    nguyên ghép của HĐ bán khác); có chặn quá nhập (tổng SL phủ ≤ SL mua của dòng).

const EPS = 1e-9

// GET /contract-ins/:contractInId/supply-targets?contractOutId=X
// Không cache (needed/covered thay đổi liên tục theo các HĐ nhập khác + slot của PM).
// Chỉ trả hàng bán của HĐ bán X (phải là 1 target của HĐ nhập). Không truyền X → HĐ bán gốc.
export async function getSupplyTargets(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  const wantOut = req.query.contractOutId ? parseInt(req.query.contractOutId) : null
  try {
    // HĐ bán home (mặc định khi không truyền contractOutId).
    const { rows: ci } = await pool.query(
      'SELECT contract_out_id FROM contract_in WHERE id = $1', [contractInId])
    if (!ci.length) return res.json({ targets: [] })
    const homeOut = ci[0].contract_out_id

    let coId = wantOut ?? homeOut
    // X phải là 1 HĐ bán đã link (contract_in_target) — nếu không, lùi về home.
    const { rows: ok } = await pool.query(
      'SELECT 1 FROM contract_in_target WHERE contract_in_id = $1 AND contract_out_id = $2',
      [contractInId, coId])
    if (!ok.length) coId = homeOut
    if (coId == null) return res.json({ targets: [] })

    const cov = await computeCoverage(coId)
    const targets = []
    for (const leaf of cov.leaves) {
      const base = leaf.group_path ? `${leaf.group_path} › ${leaf.item_name}` : leaf.item_name
      if (leaf.split) {
        for (const s of leaf.slots) {
          targets.push({
            contract_out_id: coId, boq_id: leaf.boq_id, slot_id: s.id,
            label: `${base} › ${s.name || 'Đầu bán'}`,
            unit: s.unit || leaf.unit, needed: s.needed_qty, covered: s.covered,
          })
        }
      } else {
        targets.push({
          contract_out_id: coId, boq_id: leaf.boq_id, slot_id: null, label: base,
          unit: leaf.unit, needed: leaf.needed, covered: leaf.covered,
        })
      }
    }
    res.json({ targets })
  } catch (err) {
    console.error('getSupplyTargets:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hàng bán' })
  }
}

// PUT /purchase-boq/:id/supply-links  { contract_out_id, links: [{ boq_id, slot_id, covered_qty }] }
// Thay ghép của dòng này CHỈ TRONG PHẠM VI HĐ bán contract_out_id (giữ nguyên ghép của HĐ bán
// khác). Dedup theo (boq_id, slot_id). Chặn quá nhập: tổng SL phủ MỌI HĐ bán ≤ SL mua của dòng.
export async function setLinksForInBoqRow(req, res) {
  const inBoqId = parseInt(req.params.id)
  const scopeOut = req.body?.contract_out_id ? parseInt(req.body.contract_out_id) : null
  const links = Array.isArray(req.body?.links) ? req.body.links : []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: info } = await client.query(
      `SELECT b.contract_in_id, ci.contract_out_id AS home_out, b.quantity
         FROM contract_in_boq b JOIN contract_in ci ON ci.id = b.contract_in_id
        WHERE b.id = $1`, [inBoqId])
    if (!info.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy dòng bảng giá nhập' })
    }
    const { contract_in_id, home_out } = info[0]
    const rowQty = Number(info[0].quantity) || 0
    // HĐ bán phạm vi = contract_out_id truyền vào (mặc định home); phải là 1 target.
    const outId = scopeOut ?? home_out
    const { rows: okOut } = await client.query(
      'SELECT 1 FROM contract_in_target WHERE contract_in_id = $1 AND contract_out_id = $2',
      [contract_in_id, outId])
    if (!okOut.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'HĐ bán không được liên kết với hợp đồng nhập này' })
    }

    // SL phủ đã gán cho HĐ bán KHÁC (giữ nguyên) — dùng để chặn quá nhập.
    const { rows: otherRows } = await client.query(
      `SELECT COALESCE(SUM(l.covered_qty), 0) AS s
         FROM contract_in_boq_supply_link l
         JOIN contract_out_boq ob ON ob.id = l.boq_id
        WHERE l.contract_in_boq_id = $1 AND ob.contract_out_id <> $2`,
      [inBoqId, outId])
    const otherCovered = Number(otherRows[0].s) || 0

    // Xóa ghép CHỈ của HĐ bán phạm vi (giữ ghép HĐ bán khác).
    await client.query(
      `DELETE FROM contract_in_boq_supply_link
        WHERE contract_in_boq_id = $1
          AND boq_id IN (SELECT id FROM contract_out_boq WHERE contract_out_id = $2)`,
      [inBoqId, outId])

    const seen = new Set()  // dedup theo cặp boq_id:slot_id
    let newCovered = 0
    for (const raw of links) {
      const boq_id = raw?.boq_id
      if (boq_id == null || boq_id === '') continue
      // Hàng bán phải thuộc đúng HĐ bán phạm vi.
      const { rows: chk } = await client.query(
        'SELECT id FROM contract_out_boq WHERE id = $1 AND contract_out_id = $2',
        [boq_id, outId])
      if (!chk.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Hàng bán không thuộc HĐ bán đang chọn' })
      }
      let slotId = null
      if (raw?.slot_id != null && raw.slot_id !== '') {
        const { rows: sc } = await client.query(
          'SELECT id FROM contract_out_supply_slot WHERE id = $1 AND boq_id = $2',
          [raw.slot_id, boq_id])
        if (!sc.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Đầu bán không hợp lệ' })
        }
        slotId = raw.slot_id
      }
      const dedupKey = `${boq_id}:${slotId ?? ''}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      const qty = parseFloat(raw?.covered_qty) || 0
      newCovered += qty
      await client.query(
        `INSERT INTO contract_in_boq_supply_link (contract_in_boq_id, boq_id, slot_id, covered_qty)
         VALUES ($1,$2,$3,$4)`,
        [inBoqId, boq_id, slotId, qty])
    }

    // Chặn quá nhập: tổng SL phủ (HĐ bán khác + lần này) không vượt SL mua của dòng.
    if (rowQty > 0 && otherCovered + newCovered > rowQty + EPS) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        error: `Vượt số lượng nhập: tổng "nhập cho" (${otherCovered + newCovered}) lớn hơn số lượng mua của dòng (${rowQty}). Đã nhập cho HĐ bán khác: ${otherCovered}.`,
      })
    }

    await client.query('COMMIT')
    invalidateContractIn(contract_in_id, 'boq')
    // Coverage của MỌI HĐ bán được link có thể đổi → invalidate hết cho chắc.
    const { rows: allOut } = await pool.query(
      'SELECT contract_out_id FROM contract_in_target WHERE contract_in_id = $1', [contract_in_id])
    for (const o of allOut) invalidateContract(o.contract_out_id, 'supply-coverage', 'boq')

    // Trả TOÀN BỘ ghép của dòng (mọi HĐ bán) kèm contract_out_id để FE cập nhật trọn vẹn.
    const { rows: fresh } = await pool.query(
      `SELECT l.id, l.boq_id, l.slot_id, l.covered_qty, ob.contract_out_id
         FROM contract_in_boq_supply_link l
         JOIN contract_out_boq ob ON ob.id = l.boq_id
        WHERE l.contract_in_boq_id = $1 ORDER BY l.id`, [inBoqId])
    res.json({ links: fresh })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('setLinksForInBoqRow:', err)
    res.status(500).json({ error: 'Không thể lưu ghép nhập' })
  } finally {
    client.release()
  }
}
