// Phân tích ma trận Excel serial "máy chính + thành phần" — NGHỊCH ĐẢO của
// buildSerialMatrix (src/components/contracts/deliverySerialExport.js):
//   • Cột 0 = serial MÁY. Ô trống ở cột 0 = dòng NỐI, thuộc về máy phía trên
//     (dùng khi 1 loại thành phần có nhiều serial cho cùng 1 máy).
//   • Các cột sau = từng LOẠI thành phần; tiêu đề cột (dòng 1) = tên chủng loại,
//     ô bên dưới = serial thành phần của máy ở dòng đó.
// Nhận vào AoA (mảng các dòng) từ XLSX.utils.sheet_to_json(ws, { header: 1 }).
// Trả về { machines: [{ serial, components: [{ name, serial }] }], error }.
export function parseSerialMatrix(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2)
    return { machines: [], error: 'File không có dữ liệu (cần dòng tiêu đề + ít nhất 1 dòng serial).' }

  const cell = (row, i) => String((row && row[i]) ?? '').trim()
  const header = aoa[0] || []

  // Cột thành phần = các ô tiêu đề khác rỗng từ cột 1 trở đi.
  const compCols = []
  for (let c = 1; c < header.length; c++) {
    const name = cell(header, c)
    if (name) compCols.push({ index: c, name })
  }

  const machines = []
  let current = null
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r]
    const machineSerial = cell(row, 0)
    const comps = compCols
      .map(col => ({ name: col.name, serial: cell(row, col.index) }))
      .filter(x => x.serial)

    if (machineSerial) {
      current = { serial: machineSerial, components: [...comps] }
      machines.push(current)
    } else if (comps.length) {
      // Dòng nối: gắn thành phần vào máy hiện tại.
      if (!current)
        return { machines: [], error: `Dòng ${r + 1} có serial thành phần nhưng phía trên chưa có serial máy.` }
      current.components.push(...comps)
    }
    // Dòng hoàn toàn trống → bỏ qua.
  }

  if (!machines.length)
    return { machines: [], error: 'Không tìm thấy serial máy nào trong file (cột đầu tiên).' }
  return { machines, error: null }
}
