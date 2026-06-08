// Tiện ích kiểm tra trùng serial. Serial phải DUY NHẤT trong từng phía
// (nhập = contract_in_delivery_serial, bán ra = equipment_serial) trên toàn hệ thống.
// So khớp không phân biệt hoa/thường và bỏ khoảng trắng đầu/cuối.

export const TABLE_DELIVERY  = 'contract_in_delivery_serial' // phía nhập
export const TABLE_EQUIPMENT = 'equipment_serial'            // phía bán ra

// Trong DANH SÁCH định import: trả về các serial bị lặp với nhau (giữ bản gốc đầu tiên).
export function findDuplicatesInList(serialNos) {
  const seen = new Map() // key chuẩn hoá -> chuỗi gốc
  const dups = new Set()
  for (const s of serialNos) {
    const t = String(s ?? '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) dups.add(seen.get(k))
    else seen.set(k, t)
  }
  return [...dups]
}

// Trả về các serial (trong danh sách) ĐÃ tồn tại trong bảng. db = pool hoặc client.
// table phải là một trong các hằng ở trên (không nhận input người dùng).
export async function findExistingSerials(db, table, serialNos, excludeId = null) {
  const norm = [...new Set(
    serialNos.map(s => String(s ?? '').trim()).filter(Boolean).map(s => s.toLowerCase())
  )]
  if (!norm.length) return []
  const params = [norm]
  let sql = `SELECT serial_no FROM ${table} WHERE lower(trim(serial_no)) = ANY($1)`
  if (excludeId != null) { params.push(excludeId); sql += ' AND id <> $2' }
  const { rows } = await db.query(sql, params)
  return rows.map(r => r.serial_no)
}

// Kiểm tra 1 serial đơn (nhập tay / thay thế) đã tồn tại chưa.
export async function serialExists(db, table, serialNo, excludeId = null) {
  const found = await findExistingSerials(db, table, [serialNo], excludeId)
  return found.length > 0
}

// Lần theo CHUỖI THAY THẾ chứa serialId (qua replaced_by_serial_id, cả 2 chiều):
// gốc → thay lần 1 → thay lần 2 → ... Trả về null nếu serial không nằm trong
// chuỗi thay thế nào (chưa từng thay & chưa từng bị thay).
// Kết quả: { root_serial_no, current_index (0=gốc), total, chain[] }.
export async function getReplacementChain(db, table, serialId) {
  const { rows } = await db.query(
    `WITH RECURSIVE chain AS (
       SELECT id, serial_no, status, replaced_at, replaced_by_serial_id
       FROM ${table} WHERE id = $1
       UNION
       SELECT t.id, t.serial_no, t.status, t.replaced_at, t.replaced_by_serial_id
       FROM ${table} t JOIN chain c
         ON t.replaced_by_serial_id = c.id OR t.id = c.replaced_by_serial_id
     )
     SELECT id, serial_no, status, replaced_at, replaced_by_serial_id FROM chain`,
    [serialId]
  )
  if (rows.length <= 1) return null // serial độc lập, không thuộc chuỗi thay thế

  const byId = new Map(rows.map(r => [r.id, r]))
  // Gốc = node không bị bất kỳ node nào thay thế thành (không ai trỏ replaced_by tới nó).
  const root = rows.find(r => !rows.some(o => o.replaced_by_serial_id === r.id)) || rows[0]

  // Sắp xếp gốc → mới nhất bằng cách đi theo replaced_by_serial_id.
  const ordered = []
  const seen = new Set()
  let cur = root
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    ordered.push(cur)
    cur = cur.replaced_by_serial_id ? byId.get(cur.replaced_by_serial_id) : null
  }

  return {
    root_serial_no: ordered[0].serial_no,
    current_index: ordered.findIndex(r => r.id === serialId), // 0 = gốc
    total: ordered.length,                                    // gốc + các lần thay
    chain: ordered.map((r, i) => ({
      serial_no: r.serial_no,
      status: r.status,
      replaced_at: r.replaced_at,
      generation: i,                  // 0 = gốc, 1 = thay lần 1, ...
      is_current: r.id === serialId,
    })),
  }
}
