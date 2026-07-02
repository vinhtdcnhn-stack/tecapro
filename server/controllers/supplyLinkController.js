import { pool } from '../db.js'
import { invalidateContractIn, invalidateContract } from '../services/cacheKeys.js'
import { computeCoverage } from './supplyCoverageHelpers.js'

// Phía HĐ NHẬP: cột "Nhập cho" trong tab Bảng giá mua.
//  - getSupplyTargets: danh sách [hàng bán › đầu bán] của HĐ bán cha để chọn.
//  - setLinksForInBoqRow: gán/xóa ghép cho 1 dòng bảng giá nhập (NHIỀU target/dòng —
//    1 dòng nhập gộp có thể "nhập cho" nhiều đầu bán trùng ở các phần/hệ thống khác nhau).

// GET /contract-ins/:contractInId/supply-targets
// Không cache (needed/covered thay đổi liên tục theo các HĐ nhập khác + slot của PM).
export async function getSupplyTargets(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  try {
    const { rows } = await pool.query(
      'SELECT contract_out_id FROM contract_in WHERE id = $1', [contractInId])
    const coId = rows[0]?.contract_out_id
    if (coId == null) return res.json({ targets: [] })

    const cov = await computeCoverage(coId)
    const targets = []
    for (const leaf of cov.leaves) {
      const base = leaf.group_path ? `${leaf.group_path} › ${leaf.item_name}` : leaf.item_name
      if (leaf.split) {
        for (const s of leaf.slots) {
          targets.push({
            boq_id: leaf.boq_id, slot_id: s.id,
            label: `${base} › ${s.name || 'Đầu bán'}`,
            unit: s.unit || leaf.unit, needed: s.needed_qty, covered: s.covered,
          })
        }
      } else {
        targets.push({
          boq_id: leaf.boq_id, slot_id: null, label: base,
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

// PUT /purchase-boq/:id/supply-links  { links: [{ boq_id, slot_id, covered_qty }] }
// Thay TOÀN BỘ ghép của dòng này bằng mảng mới (rỗng = bỏ hết ghép). Dedup theo (boq_id, slot_id).
export async function setLinksForInBoqRow(req, res) {
  const inBoqId = parseInt(req.params.id)
  const links = Array.isArray(req.body?.links) ? req.body.links : []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: info } = await client.query(
      `SELECT b.contract_in_id, ci.contract_out_id
         FROM contract_in_boq b JOIN contract_in ci ON ci.id = b.contract_in_id
        WHERE b.id = $1`, [inBoqId])
    if (!info.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy dòng bảng giá nhập' })
    }
    const { contract_in_id, contract_out_id } = info[0]

    await client.query('DELETE FROM contract_in_boq_supply_link WHERE contract_in_boq_id = $1', [inBoqId])

    const saved = []
    const seen = new Set()  // dedup theo cặp boq_id:slot_id
    for (const raw of links) {
      const boq_id = raw?.boq_id
      if (boq_id == null || boq_id === '') continue
      const { rows: chk } = await client.query(
        `SELECT id FROM contract_out_boq WHERE id = $1 AND contract_out_id = $2`,
        [boq_id, contract_out_id])
      if (!chk.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Hàng bán không thuộc hợp đồng này' })
      }
      let slotId = null
      if (raw?.slot_id != null && raw.slot_id !== '') {
        const { rows: sc } = await client.query(
          `SELECT id FROM contract_out_supply_slot WHERE id = $1 AND boq_id = $2`,
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
      const { rows } = await client.query(
        `INSERT INTO contract_in_boq_supply_link (contract_in_boq_id, boq_id, slot_id, covered_qty)
         VALUES ($1,$2,$3,$4) RETURNING id, boq_id, slot_id, covered_qty`,
        [inBoqId, boq_id, slotId, parseFloat(raw?.covered_qty) || 0])
      saved.push(rows[0])
    }

    await client.query('COMMIT')
    invalidateContractIn(contract_in_id, 'boq')
    invalidateContract(contract_out_id, 'supply-coverage', 'boq')
    res.json({ links: saved })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('setLinksForInBoqRow:', err)
    res.status(500).json({ error: 'Không thể lưu ghép nhập' })
  } finally {
    client.release()
  }
}
