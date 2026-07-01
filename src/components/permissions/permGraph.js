// Đồ thị phụ thuộc `requires` phía client (mirror server) — auto-bật tiền đề + cascade.
export function buildGraph(allPerms) {
  const requires = new Map()   // key -> [tiền đề trực tiếp]
  const dependents = new Map() // key -> [quyền phụ thuộc trực tiếp vào nó]
  for (const p of allPerms) {
    requires.set(p.key, p.requires || [])
    for (const r of (p.requires || [])) {
      if (!dependents.has(r)) dependents.set(r, [])
      dependents.get(r).push(p.key)
    }
  }
  // Bao đóng tiền đề (đệ quy): trả Set gồm keys + mọi requires.
  function expand(keys) {
    const out = new Set()
    const visit = (k) => {
      if (out.has(k)) return
      out.add(k)
      for (const r of (requires.get(k) || [])) visit(r)
    }
    for (const k of keys) visit(k)
    return out
  }
  // Bao đóng phụ thuộc (đệ quy) — để cascade khi bỏ một tiền đề.
  function dependentsClosure(key) {
    const out = new Set()
    const visit = (k) => {
      for (const d of (dependents.get(k) || [])) {
        if (!out.has(d)) { out.add(d); visit(d) }
      }
    }
    visit(key)
    return out
  }
  return { expand, dependentsClosure, requires }
}
