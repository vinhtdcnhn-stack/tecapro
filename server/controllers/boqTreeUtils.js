import { pool } from '../db.js'
import { roundMoney } from '../utils/money.js'

// Helpers cho bảng giá HĐ bán phân cấp (Zone → nhóm tổng hợp → dòng có giá).
// Tách khỏi boqController.js để giữ file dưới 500 dòng.

export const KIND = { ZONE: 'zone', GROUP: 'group', LEAF: 'leaf' }

// Tính tiền theo đồng tiền HĐ. Làm tròn cả đơn giá, thành tiền trước & sau VAT:
// VND → số nguyên, ngoại tệ → 2 chữ số lẻ. Thành tiền sau VAT tính trên thành tiền
// trước VAT đã làm tròn để tổng cộng khớp với từng dòng.
export function calc(qty, unitPrice, vatRate, currency) {
  const q = parseFloat(qty) || 0
  const p = roundMoney(unitPrice, currency)
  const v = parseFloat(vatRate) || 0
  const before = roundMoney(q * p, currency)
  const after  = roundMoney(before * (1 + v / 100), currency)
  return { price: p, before, after }
}

export function normKind(v) {
  return v === KIND.ZONE || v === KIND.GROUP ? v : KIND.LEAF
}

// ── Phân loại 1 dòng Excel theo dữ liệu cột (không cần cột "Cấp") ─────────────
// arr: [A name, B hs, C unit, D qty, E price, F vat, G warranty]
//   trống ĐVT & SL          → 'zone'  (Phần / phân khu)
//   có ĐVT/SL, trống đơn giá → 'group' (nhánh tổng hợp, vd "Hệ thống UPS")
//   có đơn giá              → 'leaf'  (dòng có giá)
export function classifyExcelKind(arr) {
  const hasUnit  = String(arr[2] ?? '').trim() !== ''
  const hasQty   = (parseFloat(arr[3]) || 0) > 0
  const hasPrice = (parseFloat(arr[4]) || 0) > 0
  if (!hasUnit && !hasQty) return KIND.ZONE
  if (!hasPrice) return KIND.GROUP
  return KIND.LEAF
}

// Gán parent theo tầng cho danh sách item đã có row_kind, theo thứ tự xuất hiện:
//   leaf → nhóm gần nhất (hoặc zone gần nhất); group → zone gần nhất; zone → cấp cao nhất.
// Trả về mỗi item kèm parent_idx (chỉ số trong mảng, null = cấp cao nhất).
export function linkHierarchy(items) {
  let lastZone = -1, lastGroup = -1
  return items.map((it, i) => {
    let parentIdx = null
    if (it.row_kind === KIND.ZONE) { lastZone = i; lastGroup = -1 }
    else if (it.row_kind === KIND.GROUP) { parentIdx = lastZone >= 0 ? lastZone : null; lastGroup = i }
    else { parentIdx = lastGroup >= 0 ? lastGroup : (lastZone >= 0 ? lastZone : null) }
    return { ...it, parent_idx: parentIdx }
  })
}

// ── Đồng bộ tổng HĐ = SUM số tiền các node GỐC (parent_id IS NULL) ─────────────
// Node gốc đã chứa roll-up của cả cây con (gồm hệ số ×SL của nhóm bật multiply_qty),
// nên cộng các gốc vừa khớp tổng vừa tránh đếm trùng nhóm + con.
async function syncContractTotalLeaves(contractId, db) {
  await db.query(`
    UPDATE public.contract_out c
    SET amount_before_vat = COALESCE(t.bsum, 0),
        amount_after_vat  = COALESCE(t.asum, 0),
        updated_at = now()
    FROM (
      SELECT SUM(b.amount_before_vat) AS bsum, SUM(b.amount_after_vat) AS asum
      FROM public.contract_out_boq b
      WHERE b.contract_out_id = $1
        AND b.parent_id IS NULL
    ) t
    WHERE c.id = $1
  `, [contractId])
}

// ── Tính lại số tiền roll-up cho node nhóm/zone (bottom-up) + đồng bộ tổng HĐ ──
// Dòng lá giữ nguyên amount (đã tính từ SL × đơn giá khi lưu); node có con lấy
// tổng amount của các con trực tiếp.
export async function recomputeTree(contractId, db = pool) {
  if (!contractId) return
  const { rows } = await db.query(
    `SELECT id, parent_id, row_kind, quantity, multiply_qty, amount_before_vat, amount_after_vat
       FROM public.contract_out_boq WHERE contract_out_id = $1`, [contractId])
  if (!rows.length) { await syncContractTotalLeaves(contractId, db); return }

  const { rows: cc } = await db.query(
    'SELECT currency_code FROM public.contract_out WHERE id = $1', [contractId])
  const currency = cc[0]?.currency_code || 'VND'

  const byId = new Map(rows.map(r => [String(r.id), r]))
  const childrenOf = new Map()
  for (const r of rows) {
    if (r.parent_id == null) continue
    const p = String(r.parent_id)
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p).push(r)
  }

  // Độ sâu để xử lý từ sâu nhất lên (đảm bảo con tính trước cha).
  const depthOf = (r) => {
    let d = 0, cur = r
    const seen = new Set()
    while (cur && cur.parent_id != null && !seen.has(String(cur.id))) {
      seen.add(String(cur.id)); cur = byId.get(String(cur.parent_id)); d++
    }
    return d
  }
  const ordered = [...rows].sort((a, b) => depthOf(b) - depthOf(a))

  const before = new Map(rows.map(r => [String(r.id), parseFloat(r.amount_before_vat) || 0]))
  const after  = new Map(rows.map(r => [String(r.id), parseFloat(r.amount_after_vat)  || 0]))

  const hasKids = (id) => (childrenOf.get(String(id))?.length || 0) > 0

  for (const r of ordered) {
    if (!hasKids(r.id)) continue   // lá (hoặc nhóm/zone rỗng) → giữ amount sẵn có
    let b = 0, a = 0
    for (const k of childrenOf.get(String(r.id))) {
      b += before.get(String(k.id)) || 0
      a += after.get(String(k.id))  || 0
    }
    // Nhóm bật "nhân theo SL hệ thống" → thành tiền = SUM(con) × SL.
    if (r.multiply_qty) {
      const q = parseFloat(r.quantity) || 0
      b = roundMoney(b * q, currency)
      a = roundMoney(a * q, currency)
    }
    before.set(String(r.id), b)
    after.set(String(r.id), a)
  }

  // Lưu lại các node tổng hợp có thay đổi.
  for (const r of rows) {
    if (!hasKids(r.id)) continue
    const nb = before.get(String(r.id)), na = after.get(String(r.id))
    if (Math.abs(nb - (parseFloat(r.amount_before_vat) || 0)) > 1e-6 ||
        Math.abs(na - (parseFloat(r.amount_after_vat)  || 0)) > 1e-6) {
      await db.query(
        `UPDATE public.contract_out_boq SET amount_before_vat=$1, amount_after_vat=$2, updated_at=now() WHERE id=$3`,
        [nb, na, r.id])
    }
  }

  await syncContractTotalLeaves(contractId, db)
}

// Tổng SL đã xuất hóa đơn của CẢ CÂY CON tính từ 1 node (chặn xóa/sửa khi đã xuất).
export async function subtreeInvoicedQty(boqId, db = pool) {
  const { rows } = await db.query(`
    WITH RECURSIVE sub AS (
      SELECT id FROM public.contract_out_boq WHERE id = $1
      UNION ALL
      SELECT b.id FROM public.contract_out_boq b JOIN sub ON b.parent_id = sub.id
    )
    SELECT COALESCE(SUM(it.quantity), 0) AS q
    FROM public.contract_out_invoice_item it
    WHERE it.boq_id IN (SELECT id FROM sub)
  `, [boqId])
  return parseFloat(rows[0]?.q) || 0
}

// Tổng SL đã xuất hóa đơn của một HỆ THỐNG tổ tiên (nhóm bật multiply_qty) chứa node này.
// Dùng để chặn sửa/xóa dòng con khi cả hệ thống đã được xuất hóa đơn như 1 đơn vị.
export async function ancestorSystemInvoicedQty(boqId, db = pool) {
  const { rows } = await db.query(`
    WITH RECURSIVE anc AS (
      SELECT id, parent_id, row_kind, multiply_qty FROM public.contract_out_boq WHERE id = $1
      UNION ALL
      SELECT b.id, b.parent_id, b.row_kind, b.multiply_qty
        FROM public.contract_out_boq b JOIN anc ON b.id = anc.parent_id
    )
    SELECT COALESCE(SUM(it.quantity), 0) AS q
      FROM anc JOIN public.contract_out_invoice_item it ON it.boq_id = anc.id
     WHERE anc.id <> $1 AND anc.row_kind = 'group' AND anc.multiply_qty = true
  `, [boqId])
  return parseFloat(rows[0]?.q) || 0
}

// ── Đơn vị xuất hóa đơn (thuần, không DB) ─────────────────────────────────────
// Từ TẤT CẢ dòng bảng giá của 1 HĐ, suy ra danh sách "đơn vị xuất hóa đơn":
//   - Dòng lá KHÔNG nằm trong hệ thống nào (không có tổ tiên là nhóm bật multiply_qty)
//     → xuất theo từng lá như cũ (đơn giá = unit_price của lá).
//   - Nhóm bật multiply_qty → xuất theo HỆ THỐNG: 1 đơn vị = 1 bộ, SL = SL hệ thống,
//     đơn giá = tổng thành tiền các con (giá 1 bộ), VAT = tỷ lệ gộp; các con KHÔNG xuất riêng.
// rows cần các cột: id, parent_id, row_kind, multiply_qty, item_name, unit, quantity,
//   unit_price, vat_rate, amount_before_vat, amount_after_vat.
export function computeInvoiceUnits(rows) {
  const byId = new Map(rows.map(r => [String(r.id), r]))
  const childrenOf = new Map()
  for (const r of rows) {
    if (r.parent_id == null) continue
    const p = String(r.parent_id)
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p).push(r)
  }
  const hasKids = (id) => (childrenOf.get(String(id))?.length || 0) > 0
  const isSystem = (r) => r.row_kind === KIND.GROUP && r.multiply_qty
  const underSystem = (r) => {
    let cur = r.parent_id != null ? byId.get(String(r.parent_id)) : null
    const seen = new Set()
    while (cur && !seen.has(String(cur.id))) {
      if (isSystem(cur)) return true
      seen.add(String(cur.id)); cur = cur.parent_id != null ? byId.get(String(cur.parent_id)) : null
    }
    return false
  }
  const pathOf = (r) => {
    const parts = []; const seen = new Set()
    let cur = r.parent_id != null ? byId.get(String(r.parent_id)) : null
    while (cur && !seen.has(String(cur.id))) {
      seen.add(String(cur.id)); parts.unshift(cur.item_name); cur = cur.parent_id != null ? byId.get(String(cur.parent_id)) : null
    }
    return parts.join(' › ')
  }

  const units = []
  for (const r of rows) {
    if (underSystem(r)) continue   // bị gói trong 1 hệ thống → không xuất riêng
    if (isSystem(r)) {
      const kids = childrenOf.get(String(r.id)) || []
      const unitBefore = kids.reduce((s, k) => s + (parseFloat(k.amount_before_vat) || 0), 0)
      const unitAfter  = kids.reduce((s, k) => s + (parseFloat(k.amount_after_vat)  || 0), 0)
      const qty = parseFloat(r.quantity) || 0
      const vat = unitBefore > 0 ? Math.round((unitAfter / unitBefore - 1) * 10000) / 100 : 0
      units.push({
        boq_id: r.id, item_name: r.item_name, unit: r.unit || 'Hệ thống', qty_contract: qty,
        unit_price: unitBefore, vat_rate: vat, amount_after: unitAfter * qty,
        is_system: true, group_path: pathOf(r),
      })
    } else if (r.row_kind === KIND.LEAF && !hasKids(r.id)) {
      units.push({
        boq_id: r.id, item_name: r.item_name, unit: r.unit, qty_contract: parseFloat(r.quantity) || 0,
        unit_price: parseFloat(r.unit_price) || 0, vat_rate: parseFloat(r.vat_rate) || 0,
        amount_after: parseFloat(r.amount_after_vat) || 0,
        is_system: false, group_path: pathOf(r),
      })
    }
    // nhóm/zone không nhân (có con) → bỏ qua, con của chúng mới là đơn vị xuất
  }
  return units
}
