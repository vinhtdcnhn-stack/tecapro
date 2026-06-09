import { toISODate } from './warrantyUtils'

// Tiện ích parse + kiểm tra dữ liệu Excel cho tab "Thiết bị bàn giao".
// Tách khỏi component để giữ file gọn (< 500 dòng) và dễ test.

const S = v => String(v ?? '').trim()

// Parse các dòng Excel (đã qua sheet_to_json) thành danh sách thiết bị + serial.
// Hỗ trợ "fill-down": dòng để TRỐNG cột "Tên thiết bị" được coi là dòng nối tiếp
// của thiết bị phía trên (kế thừa hãng/model/vị trí/bảo hành/số lượng), chỉ lấy
// thêm serial. Dòng có "Tên thiết bị" mở một thiết bị mới (các ô trống là cố ý trống).
//
// Trả về: { items, dupInFile, qtyMismatch, skipped }
//  - items: [{ name, brand, model, quantity, location, warranty_from, warranty_to, declaredQty, serials[] }]
//  - dupInFile: serial bị lặp trong chính file (không phân biệt hoa/thường, bỏ khoảng trắng)
//  - qtyMismatch: [{ name, brand, model, declared, actual }] thiết bị có serial nhưng số serial ≠ Số lượng
//  - skipped: số dòng có serial nhưng không gắn được vào thiết bị nào (đầu file thiếu tên)
export function parseEquipmentRows(rows) {
  const grouped = new Map()
  let cur = null      // ngữ cảnh thiết bị hiện tại (để fill-down)
  let skipped = 0

  for (const row of rows) {
    const rawName = S(row['Tên thiết bị'])
    let ctx
    if (rawName) {
      const qtyRaw = row['Số lượng']
      const qtyNum = parseFloat(qtyRaw)
      ctx = {
        name: rawName,
        brand: S(row['Hãng']),
        model: S(row['Model']),
        location: S(row['Vị trí lắp đặt']),
        warranty_from: toISODate(row['BH từ (YYYY-MM-DD)']),
        warranty_to: toISODate(row['BH đến (YYYY-MM-DD)']),
        declaredQty: (qtyRaw === '' || qtyRaw == null || isNaN(qtyNum)) ? null : qtyNum,
      }
      cur = ctx
    } else {
      // Dòng nối tiếp: phải có thiết bị phía trên
      if (!cur) { if (S(row['Serial'])) skipped++; continue }
      ctx = cur
    }

    const key = `${ctx.name}||${ctx.brand}||${ctx.model}||${ctx.location}||${ctx.warranty_from || ''}||${ctx.warranty_to || ''}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: ctx.name, brand: ctx.brand, model: ctx.model,
        quantity: ctx.declaredQty != null ? ctx.declaredQty : 1,
        location: ctx.location, warranty_from: ctx.warranty_from, warranty_to: ctx.warranty_to,
        declaredQty: ctx.declaredQty, serials: [],
      })
    }
    const sn = S(row['Serial'])
    if (sn) sn.split(';').map(s => s.trim()).filter(Boolean).forEach(s => grouped.get(key).serials.push(s))
  }

  const items = [...grouped.values()]

  // Trùng serial trong file (chuẩn hoá: bỏ khoảng trắng + không phân biệt hoa/thường)
  const seen = new Map(), dupSet = new Set()
  for (const it of items) for (const s of it.serials) {
    const k = s.toLowerCase()
    if (seen.has(k)) dupSet.add(seen.get(k))
    else seen.set(k, s)
  }
  const dupInFile = [...dupSet]

  // Lệch số lượng: chỉ xét thiết bị CÓ serial và CÓ khai "Số lượng"
  const qtyMismatch = items
    .filter(it => it.serials.length > 0 && it.declaredQty != null && it.declaredQty !== it.serials.length)
    .map(it => ({ name: it.name, brand: it.brand, model: it.model, declared: it.declaredQty, actual: it.serials.length }))

  return { items, dupInFile, qtyMismatch, skipped }
}
