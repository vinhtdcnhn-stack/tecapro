// Xuất serial bàn giao cho một ĐỢT GIAO HÀNG (phía bán).
//   • Mỗi thiết bị (máy chính) trong đợt = 1 sheet, tên sheet = tên thiết bị.
//   • Cột đầu = serial thiết bị, các cột sau = serial linh kiện theo loại (do người
//     dùng chọn + sắp xếp). Hàng đầu = tên thiết bị + tên các loại linh kiện.
//   • Tên file ngầm định = tên đợt giao hàng.
import { buildSerialMatrix } from './deliverySerialExport'

// Thiết bị linh-kiện: mọi serial đều có parent_serial_id (giống quy ước ở HandoverBatchCard).
const isComponentEquipment = (e) =>
  Array.isArray(e.serials) && e.serials.length > 0 &&
  e.serials.every(s => s.parent_serial_id != null)

// Dựng dữ liệu serial cho từng máy chính của một đợt giao.
// equipment = TOÀN BỘ thiết bị của hợp đồng (mỗi phần tử kèm .serials).
// Trả [{ equipment, machines:[{id,serial_no}], components:[{machine_id,type_name,serial_no}], types:[...] }]
export function buildBatchSerialData(equipment, deliveryId) {
  // Chỉ mục linh kiện con: parentSerialId(String) → [{ type_name, serial_no }]
  const childrenByParent = new Map()
  for (const e of equipment) {
    if (!isComponentEquipment(e)) continue
    for (const s of e.serials) {
      if (s.parent_serial_id == null) continue
      const key = String(s.parent_serial_id)
      if (!childrenByParent.has(key)) childrenByParent.set(key, [])
      childrenByParent.get(key).push({ type_name: e.name, serial_no: s.serial_no })
    }
  }

  const parents = equipment.filter(e =>
    String(e.delivery_id) === String(deliveryId) && !isComponentEquipment(e))

  return parents.map(eq => {
    const machines = (eq.serials || []).map(s => ({ id: s.id, serial_no: s.serial_no }))
    const components = []
    for (const ms of (eq.serials || [])) {
      for (const child of (childrenByParent.get(String(ms.id)) || [])) {
        components.push({ machine_id: ms.id, type_name: child.type_name, serial_no: child.serial_no })
      }
    }
    const types = [...new Set(components.map(c => c.type_name))]
    return { equipment: eq, machines, components, types }
  })
}

// Làm sạch tên sheet (Excel cấm : \ / ? * [ ] và tối đa 31 ký tự) + đảm bảo không trùng.
function sheetNamer() {
  const used = new Set()
  return (raw) => {
    let base = String(raw || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
    let name = base
    let i = 2
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${i++})`
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(name.toLowerCase())
    return name
  }
}

// Tạo & tải file Excel.
//   batchName — tên đợt giao (cũng là tên file).
//   sheets    — [{ equipment, machines, components, types(đã chọn & sắp xếp) }]
//               types = mảng tên loại linh kiện theo đúng thứ tự cột mong muốn.
export async function exportHandoverWorkbook(batchName, sheets) {
  // xlsx-js-style: bản fork giữ nguyên API SheetJS nhưng hỗ trợ style ô (in đậm hàng đầu).
  const mod = await import('xlsx-js-style')
  const XLSX = mod.default || mod
  const wb = XLSX.utils.book_new()
  const nameSheet = sheetNamer()

  for (const s of sheets) {
    const orderIndex = new Map(s.types.map((t, i) => [t, i]))
    const comps = s.components
      .filter(c => orderIndex.has(c.type_name))
      .sort((a, b) => orderIndex.get(a.type_name) - orderIndex.get(b.type_name))
    const aoa = buildSerialMatrix(s.equipment.name || 'Thiết bị', s.machines, comps)
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = (aoa[0] || ['']).map(() => ({ wch: 26 }))

    // In đậm hàng đầu (tên thiết bị + tên linh kiện).
    for (let c = 0; c < (aoa[0] || []).length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[ref]) ws[ref].s = { font: { bold: true } }
    }

    XLSX.utils.book_append_sheet(wb, ws, nameSheet(s.equipment.name || 'Thiết bị'))
  }

  const fileBase = String(batchName || 'Dot giao hang').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Dot_giao_hang'
  XLSX.writeFile(wb, `${fileBase}.xlsx`)
}
