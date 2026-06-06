// Helpers cho tab Tiến độ theo biên bản (contract progress).

export function dateDiff(planned, actual) {
  if (!planned || !actual) return null
  const p = new Date(planned), a = new Date(actual)
  return Math.round((a - p) / 86400000)
}

export function getStatusInfo(planned, actual) {
  if (!actual) {
    if (!planned) return { type: 'unknown', label: '—' }
    const daysLeft = dateDiff(new Date().toISOString().slice(0, 10), planned)
    if (daysLeft < 0) return { type: 'overdue', label: `Quá hạn ${Math.abs(daysLeft)} ngày` }
    return { type: 'pending', label: 'Chưa hoàn thành' }
  }
  const diff = dateDiff(planned, actual)
  if (diff === null) return { type: 'done', label: 'Hoàn thành' }
  if (diff <= 0)     return { type: 'ok',   label: 'Đúng hạn' }
  return               { type: 'late', label: `Trễ ${diff} ngày` }
}

export const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt) ? '—' : dt.toLocaleDateString('vi-VN')
}

const addDays = (isoDate, n) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// "Ngày dự kiến (động)": mốc tự nhảy theo ngày thực tế đã ký.
//  - offset_days tính từ "mốc gốc" (base_bb_type_id) do user chọn:
//      dự kiến = (ngày thực tế của BB gốc nếu đã ký, nếu chưa thì ngày dự kiến của BB gốc) + offset_days.
//  - Không chọn mốc gốc → mặc định lấy biên bản liền trước (theo sort_order).
//  - base_anchor='contract' → tính từ ngày ký hợp đồng (contractDate) + offset_days.
// rows phải theo đúng thứ tự sort_order. Trả về map _key → ngày (yyyy-mm-dd) hoặc null.
export function computeForecasts(rows, contractDate = null) {
  const anchorDate = contractDate ? contractDate.slice(0, 10) : null
  // Map loại BB → dòng đầu tiên mang loại đó (để tra "mốc gốc")
  const byType = new Map()
  rows.forEach(r => {
    const t = r.bb_type_id
    if (t != null && t !== '' && !byType.has(String(t))) byType.set(String(t), r)
  })

  const memo = {}
  const visiting = new Set()

  // Ngày tham chiếu của một dòng = ngày thực tế nếu đã ký, ngược lại là ngày dự kiến.
  const refOf = (r) => (r.actual_date ? r.actual_date.slice(0, 10) : forecastOf(r))

  function forecastOf(r) {
    if (r._key in memo) return memo[r._key]
    if (visiting.has(r._key)) return null            // chống tham chiếu vòng
    visiting.add(r._key)

    const actual  = r.actual_date  ? r.actual_date.slice(0, 10)  : null
    const planned = r.planned_date ? r.planned_date.slice(0, 10) : null
    const offset  = parseInt(r.offset_days, 10)
    const baseRow = (r.base_bb_type_id != null && r.base_bb_type_id !== '')
      ? byType.get(String(r.base_bb_type_id)) : null

    let result
    if (r.base_anchor === 'contract' && anchorDate && Number.isFinite(offset)) {
      result = addDays(anchorDate, offset)
    } else if (baseRow && baseRow._key !== r._key && Number.isFinite(offset)) {
      const baseRef = refOf(baseRow)
      result = baseRef ? addDays(baseRef, offset) : (actual || planned)
    } else {
      const idx = rows.indexOf(r)
      if (idx <= 0)                       result = actual || planned
      else if (Number.isFinite(offset)) {
        const prevRef = refOf(rows[idx - 1])
        result = prevRef ? addDays(prevRef, offset) : (actual || planned)
      } else                              result = actual || planned
    }

    visiting.delete(r._key)
    memo[r._key] = result
    return result
  }

  const out = {}
  rows.forEach(r => { out[r._key] = forecastOf(r) })
  return out
}

// Nhắc việc sắp tới cho mốc dự kiến (chỉ biên bản chưa ký).
// Trường hợp quá hạn đã do cột Trạng thái xử lý → ở đây chỉ nhắc khi gần tới hạn.
export function forecastHint(forecast) {
  if (!forecast) return null
  const days = dateDiff(new Date().toISOString().slice(0, 10), forecast) // forecast - hôm nay
  if (days >= 0 && days <= 5) return { type: 'soon', label: `Cần giục: còn ${days} ngày` }
  return null
}

let _tmpCtr = 0
export const tmpId = () => `tmp_${++_tmpCtr}`
