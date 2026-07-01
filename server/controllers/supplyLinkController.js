import { pool } from '../db.js'
import { invalidateContractIn, invalidateContract } from '../services/cacheKeys.js'
import { computeCoverage } from './supplyCoverageHelpers.js'

// Phía HĐ NHẬP: cột "Nhập cho" trong tab Bảng giá mua.
//  - getSupplyTargets: danh sách [hàng bán › đầu bán] của HĐ bán cha để chọn.
//  - setLinkForInBoqRow: gán/xóa ghép cho 1 dòng bảng giá nhập (1 target/dòng).

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

// PUT /purchase-boq/:id/supply-link  { boq_id, slot_id, covered_qty }
// boq_id rỗng/null = BỎ ghép (xóa link của dòng này). 1 target/dòng: thay toàn bộ link cũ.
export async function setLinkForInBoqRow(req, res) {
  const inBoqId = parseInt(req.params.id)
  const { boq_id, slot_id, covered_qty } = req.body || {}
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

    let link = null
    if (boq_id != null && boq_id !== '') {
      const { rows: chk } = await client.query(
        `SELECT id FROM contract_out_boq WHERE id = $1 AND contract_out_id = $2`,
        [boq_id, contract_out_id])
      if (!chk.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Hàng bán không thuộc hợp đồng này' })
      }
      let slotId = null
      if (slot_id != null && slot_id !== '') {
        const { rows: sc } = await client.query(
          `SELECT id FROM contract_out_supply_slot WHERE id = $1 AND boq_id = $2`,
          [slot_id, boq_id])
        if (!sc.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Đầu bán không hợp lệ' })
        }
        slotId = slot_id
      }
      const { rows } = await client.query(
        `INSERT INTO contract_in_boq_supply_link (contract_in_boq_id, boq_id, slot_id, covered_qty)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [inBoqId, boq_id, slotId, parseFloat(covered_qty) || 0])
      link = rows[0]
    }

    await client.query('COMMIT')
    invalidateContractIn(contract_in_id, 'boq')
    invalidateContract(contract_out_id, 'supply-coverage', 'boq')
    res.json({ link })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('setLinkForInBoqRow:', err)
    res.status(500).json({ error: 'Không thể lưu ghép nhập' })
  } finally {
    client.release()
  }
}
