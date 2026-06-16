// Dựng ma trận AoA để xuất Excel serial theo cấu trúc "máy chính + thành phần"
// (khớp file mẫu mau_export.xlsx):
//   • Cột đầu  = serial MÁY CHÍNH.
//   • Các cột sau = từng LOẠI thành phần; ô là serial thành phần của máy ở dòng đó.
//   • Một loại có nhiều serial cho cùng 1 máy → các serial dư xuống các dòng dưới,
//     cùng cột, cột máy để trống.
// Tham số:
//   machineColName — nhãn cột đầu (vd tên chủng loại máy "PC dell optiplex").
//   machines       — [{ id, serial_no }] các máy chính.
//   components     — [{ machine_id, type_name, serial_no }] đã sắp theo thứ tự cột mong muốn.
export function buildSerialMatrix(machineColName, machines, components) {
  // Thứ tự cột thành phần = lần xuất hiện đầu tiên trong components (giữ nguyên thứ tự backend).
  const types = []
  const seen = new Set()
  for (const c of components) {
    if (!seen.has(c.type_name)) { seen.add(c.type_name); types.push(c.type_name) }
  }

  // Gom serial thành phần theo từng máy rồi theo loại.
  const byMachine = new Map()
  for (const c of components) {
    if (!byMachine.has(c.machine_id)) byMachine.set(c.machine_id, {})
    const m = byMachine.get(c.machine_id)
    ;(m[c.type_name] ||= []).push(c.serial_no)
  }

  const aoa = [[machineColName, ...types]]
  for (const machine of machines) {
    const comps = byMachine.get(machine.id) || {}
    const rowCount = Math.max(1, ...types.map(t => (comps[t] || []).length))
    for (let r = 0; r < rowCount; r++) {
      const row = [r === 0 ? machine.serial_no : '']
      for (const t of types) row.push((comps[t] || [])[r] ?? '')
      aoa.push(row)
    }
  }
  return aoa
}
