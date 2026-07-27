import { calcAmounts, roundMoney } from './boqUtils'

// Helpers cây cho Bảng giá phân cấp (Zone → nhóm tổng hợp → dòng có giá).
// Dòng dùng `_key` làm khóa ổn định (id thật khi đã lưu, tmp khi mới). Quan hệ cha-con
// theo `parent_id` (id thật của cha). Tách khỏi useBOQTab để giữ file dưới 500 dòng.

export const ROW_KIND = { ZONE: 'zone', GROUP: 'group', LEAF: 'leaf' }
export const kindOf = (r) => r?.row_kind || ROW_KIND.LEAF

// Khóa dùng để liên kết cha: ưu tiên id thật (số), fallback _key cho dòng mới.
const keyForLink = (r) => (r.id != null ? String(r.id) : r._key)

// Dựng thứ tự hiển thị theo cây (DFS) kèm depth + số thứ tự phân cấp. Trả { r, depth, no }.
// `no` là số dạng chấm theo vị trí trên cây: gốc "1", "2"…; con của 1 là "1.1", "1.2";
// con của 1.1 là "1.1.1"… (tính lại mỗi lần render, không lưu DB).
// Sibling giữ nguyên thứ tự trong mảng `rows` (đã sort theo sort_order từ server).
export function buildTreeOrder(rows) {
  const childrenOf = new Map()
  const roots = []
  const haveKey = new Set(rows.map(keyForLink))
  for (const r of rows) {
    const pid = r.parent_id != null ? String(r.parent_id) : null
    if (pid && haveKey.has(pid)) {
      if (!childrenOf.has(pid)) childrenOf.set(pid, [])
      childrenOf.get(pid).push(r)
    } else {
      roots.push(r)
    }
  }
  const out = []
  const seen = new Set()
  const walk = (node, depth, no) => {
    if (seen.has(node._key)) return
    seen.add(node._key)
    out.push({ r: node, depth, no })
    let i = 0
    for (const k of childrenOf.get(keyForLink(node)) || []) walk(k, depth + 1, `${no}.${++i}`)
  }
  let rootSeq = 0
  for (const r of roots) walk(r, 0, String(++rootSeq))
  // An toàn: dòng nào chưa được duyệt (cha lạc) vẫn hiển thị ở cấp 0.
  for (const r of rows) if (!seen.has(r._key)) out.push({ r, depth: 0, no: String(++rootSeq) })
  return out
}

// Tập _key của một node + TOÀN BỘ cây con của nó. Dùng khi kéo cả một "Phần"/"Hệ thống"
// sang chỗ khác (con cháu phải đi theo) và để chặn thả node vào chính cây con của nó.
export function subtreeKeySet(rows, root) {
  const childrenOf = new Map()
  for (const r of rows) {
    const pid = r.parent_id != null ? String(r.parent_id) : null
    if (!pid) continue
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid).push(r)
  }
  const out = new Set([root._key])
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    for (const kid of childrenOf.get(keyForLink(node)) || []) {
      if (out.has(kid._key)) continue
      out.add(kid._key)
      stack.push(kid)
    }
  }
  return out
}

// Roll-up số tiền: lá tính từ SL × đơn giá; node có con = tổng các con.
// Nhóm bật multiply_qty → tổng các con × SL hệ thống. Trả Map _key → { before, after }.
export function computeRollup(rows, currency) {
  const childrenOf = new Map()
  for (const r of rows) {
    if (r.parent_id == null) continue
    // tìm cha theo id thật
    const parent = rows.find(x => String(x.id) === String(r.parent_id))
    if (!parent) continue
    if (!childrenOf.has(parent._key)) childrenOf.set(parent._key, [])
    childrenOf.get(parent._key).push(r)
  }
  const memo = new Map()
  const calcNode = (r) => {
    if (memo.has(r._key)) return memo.get(r._key)
    let res
    const kids = childrenOf.get(r._key)
    if (kids && kids.length) {
      // unitBefore/unitAfter = tổng các con cho 1 bộ (giá 1 hệ thống); before/after nhân SL nếu bật.
      const sum = kids.reduce((acc, k) => {
        const c = calcNode(k)
        return { before: acc.before + c.before, after: acc.after + c.after }
      }, { before: 0, after: 0 })
      if (r.multiply_qty) {
        const q = parseFloat(r.quantity) || 0
        res = {
          before: roundMoney(sum.before * q, currency), after: roundMoney(sum.after * q, currency),
          unitBefore: sum.before, unitAfter: sum.after,
        }
      } else {
        res = { before: sum.before, after: sum.after, unitBefore: sum.before, unitAfter: sum.after }
      }
    } else if (kindOf(r) === ROW_KIND.ZONE || kindOf(r) === ROW_KIND.GROUP) {
      res = { before: 0, after: 0, unitBefore: 0, unitAfter: 0 }   // nhóm/zone rỗng
    } else {
      const a = calcAmounts(r.quantity, r.unit_price, r.vat_rate, currency)
      res = { ...a, unitBefore: a.before, unitAfter: a.after }
    }
    memo.set(r._key, res)
    return res
  }
  const out = new Map()
  for (const r of rows) out.set(r._key, calcNode(r))
  return out
}

// Tổng HĐ = tổng số tiền các node GỐC trên cây đã roll-up (rollup từ computeRollup).
// Node gốc đã chứa cả cây con + hệ số ×SL của nhóm bật multiply_qty → cộng gốc vừa
// khớp tổng vừa tránh đếm trùng nhóm + con.
export function treeTotals(rows, rollup) {
  const haveKey = new Set(rows.map(keyForLink))
  return rows.reduce((acc, r) => {
    const pid = r.parent_id != null ? String(r.parent_id) : null
    const isRoot = !pid || !haveKey.has(pid)
    if (!isRoot) return acc
    const amt = rollup.get(r._key) || { before: 0, after: 0 }
    return { before: acc.before + amt.before, after: acc.after + amt.after }
  }, { before: 0, after: 0 })
}
