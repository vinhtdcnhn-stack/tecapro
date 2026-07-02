import { pool } from '../db.js'
import * as XLSX from 'xlsx'
import { TABLE_DELIVERY, serialExists, findDuplicatesInList, findExistingSerials } from './serialUtils.js'
import { parseSerialMatrix } from '../utils/serialMatrix.js'
import { norm } from './contractInDeliveryShared.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified, invalidateContractIn, invalidateSerialLookup } from '../services/cacheKeys.js'

const TAB_TTL = 10 * 60 // 10' — danh sách serial tập trung (nặng)

async function ciOfDelivery(deliveryId) {
  const { rows } = await pool.query('SELECT contract_in_id FROM contract_in_delivery WHERE id=$1', [deliveryId])
  return rows[0]?.contract_in_id
}
async function ciOfDeliveryItem(itemId) {
  const { rows } = await pool.query(
    `SELECT d.contract_in_id FROM contract_in_delivery_item di
       JOIN contract_in_delivery d ON d.id = di.delivery_id WHERE di.id=$1`, [itemId])
  return rows[0]?.contract_in_id
}
// Serial nhập đổi → các danh sách serial/hàng tập trung + đếm hàng ở đợt nhận.
function invalidateSerials(ci) {
  invalidateContractIn(ci, 'all-serials', 'all-items', 'deliveries')
}

// ── Serial của đợt nhận hàng ───────────────────────────────────────────────────

export async function getDeliverySerials(req, res) {
  try {
    // Tab Nhận hàng chỉ liệt kê serial ĐỘC LẬP (máy) của chủng loại; serial thành phần
    // (parent_serial_id != NULL) hiện dưới máy cha, không tính/liệt kê lại ở đây.
    const { rows } = await pool.query(
      'SELECT * FROM contract_in_delivery_serial WHERE delivery_item_id=$1 AND parent_serial_id IS NULL ORDER BY serial_no',
      [req.params.itemId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh sách serial' })
  }
}

export async function createDeliverySerial(req, res) {
  const { itemId } = req.params
  const { serial_no, note, parent_serial_id, status } = req.body
  if (!serial_no?.trim()) return res.status(400).json({ error: 'Số serial không được để trống' })
  try {
    if (await serialExists(pool, TABLE_DELIVERY, serial_no))
      return res.status(409).json({ error: `Serial "${serial_no.trim()}" đã tồn tại ở phía nhập.` })
    const { rows } = await pool.query(
      `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, note, parent_serial_id, status)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [itemId, serial_no.trim(), note?.trim()||null, parent_serial_id||null, status||'Đang hoạt động']
    )
    invalidateSerials(await ciOfDeliveryItem(itemId))
    invalidateSerialLookup(serial_no.trim())
    res.json(rows[0])
  } catch (err) {
    console.error('createDeliverySerial:', err)
    res.status(500).json({ error: 'Không thể thêm serial' })
  }
}

// POST /deliveries/:deliveryId/scan-batch — lưu 1 MÁY + các thành phần trong 1 transaction.
// Body: { machineItemId, machineSerial, components: [{ name, serial }] }.
// Thành phần được resolve/tạo chủng loại theo tên (trong cùng đợt) rồi nối về serial máy
// qua parent_serial_id. Nếu BẤT KỲ serial nào trùng (trong lô hoặc đã có ở phía nhập) →
// ROLLBACK toàn bộ, trả 409 (không lưu cả máy lẫn thành phần). Chỉ 1 lần kiểm tra trùng
// cho cả máy nên không phải query từng serial.
export async function saveScanBatch(req, res) {
  const { deliveryId } = req.params
  const { machineItemId, machineSerial, components = [] } = req.body
  if (!machineItemId || !machineSerial?.trim())
    return res.status(400).json({ error: 'Thiếu serial máy chính' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const allSerials = [machineSerial, ...components.map(c => c.serial)]
    const dupInList = findDuplicatesInList(allSerials)
    if (dupInList.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Serial lặp trong cùng máy: ${dupInList.join(', ')}`, duplicates: dupInList })
    }
    const existing = await findExistingSerials(client, TABLE_DELIVERY, allSerials)
    if (existing.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Serial đã tồn tại ở phía nhập: ${existing.join(', ')}`, duplicates: existing })
    }

    // Resolve / tạo dòng chủng loại cho từng tên thành phần (trong đợt này)
    const nameToId = {}
    for (const c of components) {
      const key = norm(c.name)
      if (nameToId[key]) continue
      const found = await client.query(
        `SELECT id FROM contract_in_delivery_item
           WHERE delivery_id=$1 AND lower(btrim(item_name))=lower(btrim($2)) LIMIT 1`,
        [deliveryId, c.name]
      )
      nameToId[key] = found.rows[0]
        ? found.rows[0].id
        : (await client.query(
            `INSERT INTO contract_in_delivery_item (delivery_id, item_name) VALUES ($1,$2) RETURNING id`,
            [deliveryId, c.name.trim()]
          )).rows[0].id
    }

    const mIns = await client.query(
      `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, status)
       VALUES ($1,$2,'Đang hoạt động') RETURNING id`,
      [machineItemId, machineSerial.trim()]
    )
    const machineId = mIns.rows[0].id
    for (const c of components) {
      await client.query(
        `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, parent_serial_id, status)
         VALUES ($1,$2,$3,'Đang hoạt động')`,
        [nameToId[norm(c.name)], c.serial.trim(), machineId]
      )
    }

    await client.query('COMMIT')
    invalidateSerials(await ciOfDelivery(deliveryId))
    invalidateSerialLookup(allSerials)
    res.json({ ok: true, machineSerialId: machineId, inserted: 1 + components.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('saveScanBatch:', err)
    res.status(500).json({ error: 'Không thể lưu lô serial' })
  } finally {
    client.release()
  }
}

// POST /deliveries/:deliveryId/scan-standalone — lưu 1 THIẾT BỊ LẺ (máy độc lập).
// Body: { name, serial }. name = tên chủng loại (được resolve/tạo trong đợt này),
// serial lưu với parent_serial_id = NULL (không gắn vào máy nào). Trùng (đã có ở phía
// nhập) → 409, không tạo gì. Lưu từng serial ngay khi bắn để phản hồi & chặn trùng tức thì.
export async function saveScanStandalone(req, res) {
  const { deliveryId } = req.params
  const { name, serial } = req.body
  if (!name?.trim() || !serial?.trim())
    return res.status(400).json({ error: 'Thiếu tên chủng loại hoặc serial' })
  try {
    if (await serialExists(pool, TABLE_DELIVERY, serial))
      return res.status(409).json({ error: `Serial "${serial.trim()}" đã tồn tại ở phía nhập.`, duplicate: serial.trim() })

    // Resolve / tạo dòng chủng loại theo tên (trong đợt này)
    const found = await pool.query(
      `SELECT id FROM contract_in_delivery_item
         WHERE delivery_id=$1 AND lower(btrim(item_name))=lower(btrim($2)) LIMIT 1`,
      [deliveryId, name]
    )
    const itemId = found.rows[0]
      ? found.rows[0].id
      : (await pool.query(
          `INSERT INTO contract_in_delivery_item (delivery_id, item_name) VALUES ($1,$2) RETURNING id`,
          [deliveryId, name.trim()]
        )).rows[0].id

    const ins = await pool.query(
      `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, status)
       VALUES ($1,$2,'Đang hoạt động') RETURNING *`,
      [itemId, serial.trim()]
    )
    invalidateSerials(await ciOfDelivery(deliveryId))
    invalidateSerialLookup(serial.trim())
    res.json({ ok: true, serial: ins.rows[0] })
  } catch (err) {
    console.error('saveScanStandalone:', err)
    res.status(500).json({ error: 'Không thể lưu serial' })
  }
}

// GET /delivery-items/:itemId/export-serials — dữ liệu xuất Excel theo cấu trúc
// "máy chính + thành phần": mỗi máy (serial độc lập của chủng loại này) kèm các serial
// thành phần (con) đã nhóm theo tên chủng loại thành phần (lấy từ item_name của con).
export async function getDeliveryItemExport(req, res) {
  const { itemId } = req.params
  try {
    const { rows: machines } = await pool.query(
      `SELECT id, serial_no FROM contract_in_delivery_serial
        WHERE delivery_item_id=$1 AND parent_serial_id IS NULL
        ORDER BY id`,
      [itemId]
    )
    let components = []
    if (machines.length) {
      const { rows } = await pool.query(
        `SELECT ds.parent_serial_id AS machine_id, di.item_name AS type_name, ds.serial_no
           FROM contract_in_delivery_serial ds
           JOIN contract_in_delivery_item di ON di.id = ds.delivery_item_id
          WHERE ds.parent_serial_id = ANY($1)
          ORDER BY di.id, ds.id`,
        [machines.map(m => m.id)]
      )
      components = rows
    }
    res.json({ machines, components })
  } catch (err) {
    console.error('getDeliveryItemExport:', err)
    res.status(500).json({ error: 'Không thể tải dữ liệu xuất serial' })
  }
}

// GET /delivery-serials/:id/components — danh sách linh kiện (serial con) của 1 máy chính.
// Trả về serial máy + các serial con đã gắn (parent_serial_id = :id), kèm tên chủng loại
// linh kiện (lấy từ item_name của dòng chủng loại con). Chỉ đọc, không cần quyền ghi.
export async function getSerialComponents(req, res) {
  const { id } = req.params
  try {
    const machine = await pool.query(
      'SELECT id, serial_no, status FROM contract_in_delivery_serial WHERE id=$1', [id]
    )
    if (!machine.rows[0]) return res.status(404).json({ error: 'Không tìm thấy serial' })
    const { rows } = await pool.query(
      `SELECT ds.id, ds.serial_no, ds.status, ds.note, di.item_name AS type_name
         FROM contract_in_delivery_serial ds
         JOIN contract_in_delivery_item di ON di.id = ds.delivery_item_id
        WHERE ds.parent_serial_id = $1
        ORDER BY di.item_name, ds.id`,
      [id]
    )
    res.json({ machine: machine.rows[0], components: rows })
  } catch (err) {
    console.error('getSerialComponents:', err)
    res.status(500).json({ error: 'Không thể tải linh kiện của máy' })
  }
}

export async function deleteDeliverySerial(req, res) {
  try {
    // Xóa máy thì xóa luôn linh kiện thuộc máy đó (serial con: parent_serial_id = id).
    const { rows } = await pool.query(
      'DELETE FROM contract_in_delivery_serial WHERE id=$1 OR parent_serial_id=$1 RETURNING serial_no, delivery_item_id',
      [req.params.id]
    )
    if (rows.length) {
      invalidateSerials(await ciOfDeliveryItem(rows[0].delivery_item_id))
      invalidateSerialLookup(rows.map(r => r.serial_no))
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa serial' })
  }
}

// ── Quản lý serial tập trung (toàn hợp đồng nhập) ──────────────────────────────

// GET /contract-ins/:contractInId/all-serials — gom mọi serial của mọi đợt nhận,
// kèm chủng loại hàng (delivery_item) và đợt nhận (delivery batch).
export async function getAllDeliverySerials(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'all-serials')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'all-serials'), TAB_TTL, async () => {
      const { rows } = await pool.query(`
        SELECT
          ds.id, ds.serial_no, ds.note, ds.status, ds.parent_serial_id,
          ds.replaced_by_serial_id, ds.replaced_at, ds.delivery_item_id,
          di.item_name, di.unit,
          d.id AS delivery_id, d.batch_name, d.receive_date, d.locked AS batch_locked
        FROM contract_in_delivery_serial ds
        JOIN contract_in_delivery_item di ON di.id = ds.delivery_item_id
        JOIN contract_in_delivery       d  ON d.id  = di.delivery_id
        WHERE d.contract_in_id = $1
        ORDER BY di.item_name, ds.serial_no
      `, [req.params.contractInId])
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getAllDeliverySerials:', err)
    res.status(500).json({ error: 'Không thể tải danh sách serial' })
  }
}

// GET /contract-ins/:contractInId/all-items — danh sách chủng loại của mọi đợt nhận
// (để chọn khi thêm linh kiện / import vào màn quản lý serial tập trung).
export async function getAllDeliveryItems(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'all-items')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'all-items'), TAB_TTL, async () => {
      const { rows } = await pool.query(`
        SELECT di.id, di.item_name, di.unit, d.id AS delivery_id, d.batch_name, d.receive_date, d.locked AS batch_locked
        FROM contract_in_delivery_item di
        JOIN contract_in_delivery d ON d.id = di.delivery_id
        WHERE d.contract_in_id = $1
        ORDER BY d.receive_date DESC NULLS LAST, di.item_name
      `, [req.params.contractInId])
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getAllDeliveryItems:', err)
    res.status(500).json({ error: 'Không thể tải danh mục hàng' })
  }
}

// PUT /delivery-serials/:id — sửa serial (serial_no / tình trạng / thuộc máy / ghi chú)
export async function updateDeliverySerial(req, res) {
  const { id } = req.params
  const { serial_no, note, status, parent_serial_id } = req.body
  if (!serial_no?.trim()) return res.status(400).json({ error: 'Số serial không được để trống' })
  if (String(parent_serial_id) === String(id))
    return res.status(400).json({ error: 'Không thể gắn serial vào chính nó' })
  try {
    if (await serialExists(pool, TABLE_DELIVERY, serial_no, id))
      return res.status(409).json({ error: `Serial "${serial_no.trim()}" đã tồn tại ở phía nhập.` })
    const { rows } = await pool.query(
      `UPDATE contract_in_delivery_serial
         SET serial_no=$1, note=$2, status=$3, parent_serial_id=$4
       WHERE id=$5 RETURNING *`,
      [serial_no.trim(), note?.trim()||null, status||'Đang hoạt động', parent_serial_id||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    invalidateSerials(await ciOfDeliveryItem(rows[0].delivery_item_id))
    invalidateSerialLookup(rows[0].serial_no)
    res.json(rows[0])
  } catch (err) {
    console.error('updateDeliverySerial:', err)
    res.status(500).json({ error: 'Không thể cập nhật serial' })
  }
}

// POST /delivery-serials/bulk-delete  { ids: [...] }
export async function bulkDeleteDeliverySerials(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })
  try {
    // Xóa máy nào thì xóa luôn linh kiện con của máy đó (parent_serial_id ∈ ids).
    const { rows } = await pool.query(
      'DELETE FROM contract_in_delivery_serial WHERE id = ANY($1::int[]) OR parent_serial_id = ANY($1::int[]) RETURNING serial_no, delivery_item_id', [ids]
    )
    if (rows.length) {
      invalidateSerials(await ciOfDeliveryItem(rows[0].delivery_item_id))
      invalidateSerialLookup(rows.map(r => r.serial_no))
    }
    res.json({ success: true, count: rows.length })
  } catch (err) {
    console.error('bulkDeleteDeliverySerials:', err)
    res.status(500).json({ error: 'Không thể xóa các serial đã chọn' })
  }
}

// POST /delivery-serials/:id/replace  { new_serial_no, replaced_at }
// Tạo serial mới (cùng chủng loại + thừa kế máy cha), đánh dấu serial cũ "Đã thay thế".
export async function replaceDeliverySerial(req, res) {
  const { id } = req.params
  const { new_serial_no, replaced_at } = req.body
  if (!new_serial_no?.trim()) return res.status(400).json({ error: 'Serial mới không được để trống' })
  const client = await pool.connect()
  try {
    const old = await client.query('SELECT * FROM contract_in_delivery_serial WHERE id=$1', [id])
    if (!old.rows[0]) return res.status(404).json({ error: 'Không tìm thấy serial' })
    if (await serialExists(client, TABLE_DELIVERY, new_serial_no))
      return res.status(409).json({ error: `Serial "${new_serial_no.trim()}" đã tồn tại ở phía nhập.` })

    await client.query('BEGIN')
    const o = old.rows[0]
    const ins = await client.query(
      `INSERT INTO contract_in_delivery_serial
         (delivery_item_id, serial_no, parent_serial_id, status)
       VALUES ($1,$2,$3,'Đang hoạt động') RETURNING *`,
      [o.delivery_item_id, new_serial_no.trim(), o.parent_serial_id]
    )
    const newSerial = ins.rows[0]
    await client.query(
      `UPDATE contract_in_delivery_serial
         SET status='Đã thay thế', replaced_by_serial_id=$1, replaced_at=$2
       WHERE id=$3`,
      [newSerial.id, replaced_at || new Date().toISOString().slice(0,10), id]
    )
    await client.query('COMMIT')
    invalidateSerials(await ciOfDeliveryItem(o.delivery_item_id))
    invalidateSerialLookup(o.serial_no, newSerial.serial_no)
    res.json({ new_serial: newSerial })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('replaceDeliverySerial:', err)
    res.status(500).json({ error: 'Không thể thay thế serial' })
  } finally {
    client.release()
  }
}

// Import serial từ Excel theo cấu trúc "máy chính + thành phần":
//   • Cột đầu  = serial MÁY (chủng loại :itemId). Ô trống = dòng nối của máy trên.
//   • Các cột sau = từng LOẠI thành phần (tiêu đề = tên chủng loại); thành phần
//     được resolve/tạo chủng loại theo tên TRONG ĐỢT rồi nối về máy qua
//     parent_serial_id (giống saveScanBatch, nhưng hàng loạt nhiều máy).
// File 1 cột (chỉ serial máy) vẫn chạy như cũ — không có cột thành phần thì mỗi
// dòng chỉ tạo 1 serial máy. Bất kỳ serial nào trùng (trong file hoặc đã có ở phía
// nhập) → ROLLBACK toàn bộ, không lưu gì.
export async function importDeliverySerials(req, res) {
  const { itemId } = req.params
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const wb  = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const { machines, error } = parseSerialMatrix(aoa)
    if (error) return res.status(400).json({ error })

    // Gom toàn bộ serial (máy + thành phần) để kiểm tra trùng 1 lần.
    const allSerials = []
    for (const m of machines) {
      allSerials.push(m.serial)
      for (const c of m.components) allSerials.push(c.serial)
    }

    const dupInFile = findDuplicatesInList(allSerials)
    if (dupInFile.length)
      return res.status(400).json({ error: `File có serial bị lặp: ${dupInFile.join(', ')}`, duplicates: dupInFile })
    const existing = await findExistingSerials(pool, TABLE_DELIVERY, allSerials)
    if (existing.length)
      return res.status(409).json({ error: `Các serial sau đã tồn tại ở phía nhập: ${existing.join(', ')}`, duplicates: existing })

    // Cần deliveryId để resolve/tạo dòng chủng loại cho thành phần theo tên.
    const di = await pool.query('SELECT delivery_id FROM contract_in_delivery_item WHERE id=$1', [itemId])
    if (!di.rows[0]) return res.status(404).json({ error: 'Không tìm thấy chủng loại.' })
    const deliveryId = di.rows[0].delivery_id

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Resolve / tạo dòng chủng loại cho từng tên thành phần (trong đợt này).
      const nameToId = {}
      for (const m of machines) {
        for (const c of m.components) {
          const key = norm(c.name)
          if (nameToId[key]) continue
          const found = await client.query(
            `SELECT id FROM contract_in_delivery_item
               WHERE delivery_id=$1 AND lower(btrim(item_name))=lower(btrim($2)) LIMIT 1`,
            [deliveryId, c.name]
          )
          nameToId[key] = found.rows[0]
            ? found.rows[0].id
            : (await client.query(
                `INSERT INTO contract_in_delivery_item (delivery_id, item_name) VALUES ($1,$2) RETURNING id`,
                [deliveryId, c.name.trim()]
              )).rows[0].id
        }
      }

      // Mỗi máy: chèn serial máy (parent NULL) rồi các serial thành phần (parent = máy).
      const insertedMachines = []
      for (const m of machines) {
        const mIns = await client.query(
          `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, status)
           VALUES ($1,$2,'Đang hoạt động') RETURNING *`,
          [itemId, m.serial]
        )
        const machineRow = mIns.rows[0]
        insertedMachines.push(machineRow)
        for (const c of m.components) {
          await client.query(
            `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, parent_serial_id, status)
             VALUES ($1,$2,$3,'Đang hoạt động')`,
            [nameToId[norm(c.name)], c.serial, machineRow.id]
          )
        }
      }

      await client.query('COMMIT')
      invalidateSerials(await ciOfDelivery(deliveryId))
      invalidateSerialLookup(allSerials)
      res.json({ imported: allSerials.length, machines: insertedMachines.length, items: insertedMachines })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('importDeliverySerials:', err)
    // err ở đây có thể là lỗi Postgres (FK/constraint) — không trả message thô lộ tên bảng/constraint.
    res.status(500).json({ error: 'Lỗi import serial. Kiểm tra lại file hoặc thử lại sau.' })
  }
}
