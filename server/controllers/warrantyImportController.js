import { pool } from '../db.js'
import { TABLE_EQUIPMENT, findDuplicatesInList, findExistingSerials } from './serialUtils.js'

// Import thiết bị từ Excel (nhận parsed JSON từ frontend)
// Body: Array of { name, brand, model, quantity, location, warranty_from, warranty_to, serials[] }
export async function importEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  const items = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Không có dữ liệu để import' })
  }

  // Gom toàn bộ serial trong file để chặn trùng (trong file + đã có trong hệ thống).
  const allSerials = []
  for (const item of items)
    if (Array.isArray(item.serials))
      for (const sn of item.serials) if (sn?.trim()) allSerials.push(sn.trim())

  const dupInFile = findDuplicatesInList(allSerials)
  if (dupInFile.length)
    return res.status(400).json({ error: `File có serial bị lặp: ${dupInFile.join(', ')}`, duplicates: dupInFile })
  const existing = await findExistingSerials(pool, TABLE_EQUIPMENT, allSerials)
  if (existing.length)
    return res.status(409).json({ error: `Các serial sau đã tồn tại ở phía bán ra: ${existing.join(', ')}`, duplicates: existing })

  const client = await pool.connect()
  let imported = 0
  try {
    await client.query('BEGIN')
    for (const item of items) {
      const hasSerial = item.serials && item.serials.length > 0
      const { rows } = await client.query(
        `INSERT INTO contract_equipment
           (contract_out_id, name, brand, model, quantity, location, warranty_from, warranty_to, has_serial)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [contractId, item.name?.trim(), item.brand?.trim()||null, item.model?.trim()||null,
         parseFloat(item.quantity)||1, item.location?.trim()||null,
         item.warranty_from||null, item.warranty_to||null, hasSerial]
      )
      const equipmentId = rows[0].id
      if (hasSerial) {
        for (const sn of item.serials) {
          if (sn?.trim()) {
            await client.query(
              'INSERT INTO equipment_serial (equipment_id, serial_no) VALUES ($1, $2)',
              [equipmentId, sn.trim()]
            )
          }
        }
      }
      imported++
    }
    await client.query('COMMIT')
    res.json({ success: true, imported })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('importEquipment:', err)
    res.status(500).json({ error: 'Lỗi khi import dữ liệu' })
  } finally {
    client.release()
  }
}

// Thêm/Import serial linh kiện: tự tìm-hoặc-tạo loại thiết bị theo (tên, hãng, model),
// thêm serial kèm bảo hành riêng, gắn máy cha theo parent_serial_id hoặc parent_serial_no.
// Body: [{ name, brand, model, serial_no, warranty_from, warranty_to, parent_serial_id?, parent_serial_no? }]
export async function importComponentSerials(req, res) {
  const contractId = parseInt(req.params.id)
  const items = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Không có dữ liệu để thêm' })
  }

  // Chặn trùng serial: trong chính danh sách + đã tồn tại ở phía bán ra.
  const allSerials = items.map(it => (it.serial_no || '').trim()).filter(Boolean)
  const dupInFile = findDuplicatesInList(allSerials)
  if (dupInFile.length)
    return res.status(400).json({ error: `Danh sách có serial bị lặp: ${dupInFile.join(', ')}`, duplicates: dupInFile })
  const existsAlready = await findExistingSerials(pool, TABLE_EQUIPMENT, allSerials)
  if (existsAlready.length)
    return res.status(409).json({ error: `Các serial sau đã tồn tại ở phía bán ra: ${existsAlready.join(', ')}`, duplicates: existsAlready })

  const client = await pool.connect()
  let imported = 0
  try {
    await client.query('BEGIN')

    // Bản đồ serial_no → id (serial đã có trong hợp đồng) để dò máy cha
    const snMap = new Map()
    const existing = await client.query(
      `SELECT s.id, s.serial_no FROM equipment_serial s
       JOIN contract_equipment e ON e.id = s.equipment_id
       WHERE e.contract_out_id = $1`, [contractId])
    existing.rows.forEach(r => snMap.set(r.serial_no, r.id))

    const eqCache = new Map()
    async function findOrCreateEquipment(name, brand, model) {
      const key = `${name}||${brand||''}||${model||''}`
      if (eqCache.has(key)) return eqCache.get(key)
      const found = await client.query(
        `SELECT id FROM contract_equipment
          WHERE contract_out_id=$1 AND name=$2
            AND COALESCE(brand,'')=COALESCE($3,'') AND COALESCE(model,'')=COALESCE($4,'') LIMIT 1`,
        [contractId, name, brand, model])
      let id = found.rows[0]?.id
      if (!id) {
        const ins = await client.query(
          `INSERT INTO contract_equipment (contract_out_id, name, brand, model, quantity, has_serial)
           VALUES ($1,$2,$3,$4,1,true) RETURNING id`,
          [contractId, name, brand, model])
        id = ins.rows[0].id
      }
      eqCache.set(key, id)
      return id
    }

    const pendingParents = []
    for (const it of items) {
      const name = (it.name || '').trim()
      const sn   = (it.serial_no || '').trim()
      if (!name || !sn) continue
      const eqId = await findOrCreateEquipment(name, (it.brand||'').trim()||null, (it.model||'').trim()||null)
      const directParent = it.parent_serial_id || null
      const ins = await client.query(
        `INSERT INTO equipment_serial (equipment_id, serial_no, warranty_from, warranty_to, parent_serial_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [eqId, sn, it.warranty_from||null, it.warranty_to||null, directParent])
      const newId = ins.rows[0].id
      snMap.set(sn, newId)
      if (!directParent && it.parent_serial_no && String(it.parent_serial_no).trim())
        pendingParents.push({ serialId: newId, parentSN: String(it.parent_serial_no).trim() })
      imported++
    }

    for (const p of pendingParents) {
      const pid = snMap.get(p.parentSN)
      if (pid && pid !== p.serialId)
        await client.query('UPDATE equipment_serial SET parent_serial_id=$1 WHERE id=$2', [pid, p.serialId])
    }

    await client.query('COMMIT')
    res.json({ success: true, imported })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('importComponentSerials:', err)
    res.status(500).json({ error: 'Lỗi khi thêm serial linh kiện' })
  } finally {
    client.release()
  }
}
