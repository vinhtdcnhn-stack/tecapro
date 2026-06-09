// Tính "Ngày dự kiến" (forecast) của các mốc biên bản — bản port từ
// src/components/contracts/progressUtils.js (computeForecasts) sang server.
// Dùng id thay cho _key. rows phải đã sort theo sort_order, id.
//   - base_anchor='contract' → ngày ký HĐ + offset_days
//   - base_bb_type_id        → ngày THỰC TẾ của mốc gốc + offset_days (gốc chưa có ngày thực tế → null)
//   - mặc định               → ngày thực tế của biên bản liền trước + offset_days
//   - biên bản đầu tiên       → Ngày theo HĐ (planned_date)
// Trả về map: progressId → 'yyyy-mm-dd' | null.

const addDays = (isoDate, n) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const iso = (v) => (v ? String(v).slice(0, 10) : null)

export function computeForecasts(rows, contractDate = null) {
  const anchorDate = contractDate ? iso(contractDate) : null
  const byType = new Map()
  rows.forEach(r => {
    const t = r.bb_type_id
    if (t != null && t !== '' && !byType.has(String(t))) byType.set(String(t), r)
  })
  const actualOf = (r) => (r && r.actual_date ? iso(r.actual_date) : null)

  const out = {}
  rows.forEach((r, idx) => {
    const planned   = iso(r.planned_date)
    const offset    = parseInt(r.offset_days, 10)
    const hasOffset = Number.isFinite(offset)
    const baseRow   = (r.base_bb_type_id != null && r.base_bb_type_id !== '')
      ? byType.get(String(r.base_bb_type_id)) : null

    let result
    if (r.base_anchor === 'contract' && anchorDate && hasOffset) {
      result = addDays(anchorDate, offset)
    } else if (baseRow && baseRow.id !== r.id) {
      const baseActual = actualOf(baseRow)
      result = (baseActual && hasOffset) ? addDays(baseActual, offset) : null
    } else if (idx > 0) {
      const prevActual = actualOf(rows[idx - 1])
      result = (prevActual && hasOffset) ? addDays(prevActual, offset) : null
    } else {
      result = planned
    }
    out[r.id] = result
  })
  return out
}
