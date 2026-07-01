import { pool } from '../db.js'

// Tính độ phủ NHẬP HÀNG cho bảng giá 1 HĐ bán. Dùng chung cho:
//   - tab "Theo dõi nhập hàng" (chi tiết leaf + đầu bán + link)
//   - chấm màu ở tab Bảng giá bán (chỉ lấy status theo boq_id)
//   - dropdown "Nhập cho" phía HĐ nhập (danh sách target = leaf/đầu bán)
// Tách khỏi controller để 1 nguồn sự thật + giữ file < 500 dòng.

const EPS = 1e-9

// Trạng thái theo SL: 0 phủ → 'none'; <needed → 'partial'; ≥needed → 'full'.
// needed ≤ 0 (không có yêu cầu SL) → coi như 'full' (không cần nhập thêm).
export function coverageStatus(needed, covered) {
  const n = Number(needed) || 0
  const c = Number(covered) || 0
  if (n <= 0) return 'full'
  if (c <= 0) return 'none'
  return c + EPS >= n ? 'full' : 'partial'
}

function mapLink(l) {
  return {
    link_id: l.id,
    contract_in_boq_id: l.contract_in_boq_id,
    contract_in_id: l.contract_in_id,
    contract_in_no: l.contract_in_no,
    in_item_name: l.in_item_name,
    covered_qty: Number(l.covered_qty) || 0,
  }
}

// Trả { leaves: [...] }. Mỗi leaf CẦN NHẬP (row_kind='leaf', không con, no_import_needed=false):
//   { boq_id, item_name, unit, group_path, quantity, split, needed, covered, status,
//     slots: [ { id, name, unit, needed_qty, covered, status, note, links:[...] } ],
//     direct_links: [...] }  // khi chưa tách đầu bán
export async function computeCoverage(contractOutId, db = pool) {
  const { rows: boq } = await db.query(
    `SELECT id, parent_id, row_kind, item_name, unit, quantity, no_import_needed
       FROM contract_out_boq WHERE contract_out_id = $1 ORDER BY sort_order, id`,
    [contractOutId])
  if (!boq.length) return { leaves: [] }

  const byId = new Map(boq.map(r => [String(r.id), r]))
  const childrenOf = new Map()
  for (const r of boq) {
    if (r.parent_id == null) continue
    const p = String(r.parent_id)
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p).push(r)
  }
  const hasKids = (id) => (childrenOf.get(String(id))?.length || 0) > 0
  const pathOf = (r) => {
    const parts = []; const seen = new Set()
    let cur = r.parent_id != null ? byId.get(String(r.parent_id)) : null
    while (cur && !seen.has(String(cur.id))) {
      seen.add(String(cur.id)); parts.unshift(cur.item_name)
      cur = cur.parent_id != null ? byId.get(String(cur.parent_id)) : null
    }
    return parts.join(' › ')
  }

  const leaves = boq.filter(r => r.row_kind === 'leaf' && !hasKids(r.id) && !r.no_import_needed)
  if (!leaves.length) return { leaves: [] }
  const leafIds = leaves.map(r => r.id)

  const { rows: slots } = await db.query(
    `SELECT id, boq_id, name, needed_qty, unit, sort_order, note
       FROM contract_out_supply_slot WHERE boq_id = ANY($1::bigint[])
      ORDER BY sort_order, id`, [leafIds])
  const slotsByLeaf = new Map()
  for (const s of slots) {
    const k = String(s.boq_id)
    if (!slotsByLeaf.has(k)) slotsByLeaf.set(k, [])
    slotsByLeaf.get(k).push(s)
  }

  const { rows: links } = await db.query(
    `SELECT l.id, l.contract_in_boq_id, l.boq_id, l.slot_id, l.covered_qty,
            b.item_name AS in_item_name, ci.id AS contract_in_id, ci.contract_no AS contract_in_no
       FROM contract_in_boq_supply_link l
       JOIN contract_in_boq b ON b.id = l.contract_in_boq_id
       JOIN contract_in ci ON ci.id = b.contract_in_id
      WHERE l.boq_id = ANY($1::bigint[])`, [leafIds])
  const linksByLeaf = new Map()
  for (const l of links) {
    const k = String(l.boq_id)
    if (!linksByLeaf.has(k)) linksByLeaf.set(k, [])
    linksByLeaf.get(k).push(l)
  }

  const out = []
  for (const leaf of leaves) {
    const lk = String(leaf.id)
    const leafSlots = slotsByLeaf.get(lk) || []
    const leafLinks = linksByLeaf.get(lk) || []
    const common = {
      boq_id: leaf.id, item_name: leaf.item_name, unit: leaf.unit,
      group_path: pathOf(leaf), quantity: Number(leaf.quantity) || 0,
    }
    if (leafSlots.length) {
      const slotsOut = leafSlots.map(s => {
        const sl = leafLinks.filter(l => String(l.slot_id) === String(s.id))
        const covered = sl.reduce((a, l) => a + (Number(l.covered_qty) || 0), 0)
        return {
          id: s.id, name: s.name, unit: s.unit, note: s.note,
          needed_qty: Number(s.needed_qty) || 0, covered,
          status: coverageStatus(s.needed_qty, covered), links: sl.map(mapLink),
        }
      })
      const needed = slotsOut.reduce((a, s) => a + s.needed_qty, 0)
      const covered = slotsOut.reduce((a, s) => a + s.covered, 0)
      const allFull = slotsOut.every(s => s.status === 'full')
      const anyCovered = slotsOut.some(s => s.covered > 0)
      out.push({ ...common, split: true, needed, covered,
        status: allFull ? 'full' : (anyCovered ? 'partial' : 'none'),
        slots: slotsOut, direct_links: [] })
    } else {
      const direct = leafLinks.filter(l => l.slot_id == null)
      const covered = direct.reduce((a, l) => a + (Number(l.covered_qty) || 0), 0)
      const needed = Number(leaf.quantity) || 0
      out.push({ ...common, split: false, needed, covered,
        status: coverageStatus(needed, covered), slots: [], direct_links: direct.map(mapLink) })
    }
  }
  return { leaves: out }
}
