import { TABLE_EQUIPMENT, findExistingSerials } from './serialUtils.js'

// Tìm-hoặc-tạo loại thiết bị (contract_equipment) theo (contract, tên, hãng, model).
// Trả về equipment_id. Dùng cache để không query lại cùng một loại trong một lô.
// db = client (trong transaction) hoặc pool.
export function makeFindOrCreateEquipment(db, contractId, cache = new Map()) {
  // extra: { location, warranty_from, warranty_to, delivery_id } — chỉ dùng khi TẠO MỚI loại
  // thiết bị (để linh kiện kéo từ phía nhập kế thừa vị trí + hạn BH + đợt giao của máy cha).
  // Không ghi đè loại đã có.
  return async function findOrCreateEquipment(name, brand = null, model = null, extra = {}) {
    const key = `${name}||${brand || ''}||${model || ''}`
    if (cache.has(key)) return cache.get(key)
    const found = await db.query(
      `SELECT id FROM contract_equipment
        WHERE contract_out_id=$1 AND name=$2
          AND COALESCE(brand,'')=COALESCE($3,'') AND COALESCE(model,'')=COALESCE($4,'') LIMIT 1`,
      [contractId, name, brand, model])
    let id = found.rows[0]?.id
    if (!id) {
      const ins = await db.query(
        `INSERT INTO contract_equipment (contract_out_id, name, brand, model, quantity, has_serial, location, warranty_from, warranty_to, delivery_id)
         VALUES ($1,$2,$3,$4,1,true,$5,$6,$7,$8) RETURNING id`,
        [contractId, name, brand, model, extra.location || null, extra.warranty_from || null, extra.warranty_to || null, extra.delivery_id || null])
      id = ins.rows[0].id
    }
    cache.set(key, id)
    return id
  }
}

// Tự kéo linh kiện (serial con) từ phía NHẬP sang phía BÁN khi một serial MÁY được bàn giao.
// Khớp 2 phía qua serial_no; linh kiện = các serial bên nhập có parent_serial_id = serial máy.
// Linh kiện tạo bên bán kế thừa hạn BH của máy chính (warrantyFrom/To do caller truyền vào).
//
// db   = client trong transaction của caller (KHÔNG tự mở pool — để caller kiểm soát commit).
// machines = [{ serialId, serialNo, warrantyFrom, warrantyTo }] — serial MÁY bên bán vừa tạo.
// Trả { added, names } — số linh kiện đã thêm.
export async function pullImportComponents(db, contractId, machines) {
  const result = { added: 0, names: [] }
  const list = (machines || []).filter(m => m && m.serialId && (m.serialNo || '').trim())
  if (!list.length) return result

  // serial máy (chuẩn hoá) → { serialId, warrantyFrom, warrantyTo } bên bán
  const byNorm = new Map()
  for (const m of list) byNorm.set(String(m.serialNo).trim().toLowerCase(), m)
  const norms = [...byNorm.keys()]

  // 1. Tìm serial máy tương ứng ở phía nhập (theo serial_no).
  const impParents = await db.query(
    `SELECT id, serial_no FROM contract_in_delivery_serial
      WHERE lower(trim(serial_no)) = ANY($1)`, [norms])
  if (!impParents.rows.length) return result

  // importSerialId → máy bên bán (qua serial_no chuẩn hoá)
  const impIdToMachine = new Map()
  for (const r of impParents.rows) {
    const m = byNorm.get(String(r.serial_no).trim().toLowerCase())
    if (m) impIdToMachine.set(r.id, m)
  }
  const impIds = [...impIdToMachine.keys()]
  if (!impIds.length) return result

  // 2. Lấy linh kiện con của các serial máy đó ở phía nhập.
  const kids = await db.query(
    `SELECT ds.serial_no, ds.parent_serial_id, di.item_name
       FROM contract_in_delivery_serial ds
       JOIN contract_in_delivery_item di ON di.id = ds.delivery_item_id
      WHERE ds.parent_serial_id = ANY($1)`, [impIds])
  if (!kids.rows.length) return result

  // 3. Bỏ qua linh kiện đã có ở phía bán (idempotent, tránh vi phạm unique).
  const childSNs = kids.rows.map(k => (k.serial_no || '').trim()).filter(Boolean)
  const existing = await findExistingSerials(db, TABLE_EQUIPMENT, childSNs)
  const existSet = new Set(existing.map(s => s.trim().toLowerCase()))

  // 4. Tạo linh kiện bên bán, kế thừa hạn máy chính.
  const findOrCreateEquipment = makeFindOrCreateEquipment(db, contractId)
  // Tránh chèn trùng trong chính lô này.
  const seenInBatch = new Set()
  for (const k of kids.rows) {
    const sn = (k.serial_no || '').trim()
    if (!sn) continue
    const low = sn.toLowerCase()
    if (existSet.has(low) || seenInBatch.has(low)) continue
    const machine = impIdToMachine.get(k.parent_serial_id)
    if (!machine) continue
    const name = (k.item_name || '').trim() || 'Linh kiện'
    // Loại linh kiện mới kế thừa vị trí + hạn BH + đợt giao của máy cha.
    const eqId = await findOrCreateEquipment(name, null, null, {
      location: machine.location, warranty_from: machine.warrantyFrom, warranty_to: machine.warrantyTo,
      delivery_id: machine.deliveryId,
    })
    await db.query(
      `INSERT INTO equipment_serial (equipment_id, serial_no, parent_serial_id, warranty_from, warranty_to, status)
       VALUES ($1,$2,$3,$4,$5,'Đang hoạt động')`,
      [eqId, sn, machine.serialId, machine.warrantyFrom || null, machine.warrantyTo || null])
    seenInBatch.add(low)
    result.added++
    result.names.push(sn)
  }
  return result
}
