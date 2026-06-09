import { pool } from '../db.js'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { TABLE_DELIVERY, serialExists, findDuplicatesInList, findExistingSerials } from './serialUtils.js'

export const excelUploadDelivery = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận .xlsx/.xls'), ok)
  }
})

// ── Delivery batches ──────────────────────────────────────────────────────────

export async function getDeliveries(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        d.*,
        COUNT(di.id)::int                         AS item_count,
        COALESCE(SUM(di.received_quantity), 0)    AS total_received
      FROM contract_in_delivery d
      LEFT JOIN contract_in_delivery_item di ON di.delivery_id = d.id
      WHERE d.contract_in_id = $1
      GROUP BY d.id
      ORDER BY d.receive_date DESC, d.id DESC
    `, [req.params.contractInId])
    res.json(rows)
  } catch (err) {
    console.error('getDeliveries:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đợt nhận hàng' })
  }
}

export async function createDelivery(req, res) {
  const { contractInId } = req.params
  const { batch_name, receive_date, warehouse, status, note } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_delivery
        (contract_in_id, batch_name, receive_date, warehouse, status, note)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *, 0 AS item_count, 0 AS total_received
    `, [contractInId, batch_name?.trim()||null, receive_date||null,
        warehouse?.trim()||null, status||'Chờ nhận', note?.trim()||null])
    res.json(rows[0])
  } catch (err) {
    console.error('createDelivery:', err)
    res.status(500).json({ error: 'Không thể tạo đợt nhận hàng' })
  }
}

export async function updateDelivery(req, res) {
  const { id } = req.params
  const { batch_name, receive_date, warehouse, status, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_in_delivery SET
        batch_name=$1, receive_date=$2, warehouse=$3, status=$4, note=$5, updated_at=NOW()
      WHERE id=$6 RETURNING *
    `, [batch_name?.trim()||null, receive_date||null,
        warehouse?.trim()||null, status||'Chờ nhận', note?.trim()||null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đợt nhận' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateDelivery:', err)
    res.status(500).json({ error: 'Không thể cập nhật đợt nhận hàng' })
  }
}

export async function deleteDelivery(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_delivery WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa đợt nhận hàng' })
  }
}

// ── Delivery items ────────────────────────────────────────────────────────────

export async function getDeliveryItems(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        di.*,
        COUNT(ds.id)::int AS serial_count
      FROM contract_in_delivery_item di
      LEFT JOIN contract_in_delivery_serial ds ON ds.delivery_item_id = di.id
      WHERE di.delivery_id = $1
      GROUP BY di.id
      ORDER BY di.id
    `, [req.params.deliveryId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh mục hàng' })
  }
}

export async function createDeliveryItem(req, res) {
  const { deliveryId } = req.params
  const { boq_item_id, item_name, unit, ordered_quantity, received_quantity, note } = req.body
  if (!item_name?.trim()) return res.status(400).json({ error: 'Tên hàng hóa không được để trống' })
  try {
    // Trong cùng 1 đợt nhận, chủng loại hàng hóa không được trùng (không phân biệt hoa/thường).
    const dup = await pool.query(
      `SELECT 1 FROM contract_in_delivery_item
         WHERE delivery_id=$1 AND lower(btrim(item_name))=lower(btrim($2)) LIMIT 1`,
      [deliveryId, item_name]
    )
    if (dup.rows.length)
      return res.status(409).json({ error: `Chủng loại "${item_name.trim()}" đã có trong đợt nhận này. Mỗi chủng loại chỉ thêm một dòng.` })

    const { rows } = await pool.query(`
      INSERT INTO contract_in_delivery_item
        (delivery_id, boq_item_id, item_name, unit, ordered_quantity, received_quantity, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *, 0 AS serial_count
    `, [deliveryId, boq_item_id||null, item_name.trim(), unit?.trim()||'',
        parseFloat(ordered_quantity)||0, parseFloat(received_quantity)||0, note?.trim()||null])
    res.json(rows[0])
  } catch (err) {
    console.error('createDeliveryItem:', err)
    res.status(500).json({ error: 'Không thể thêm hàng hóa' })
  }
}

export async function updateDeliveryItem(req, res) {
  const { id } = req.params
  const { item_name, unit, ordered_quantity, received_quantity, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_in_delivery_item SET
        item_name=$1, unit=$2, ordered_quantity=$3, received_quantity=$4, note=$5
      WHERE id=$6 RETURNING *
    `, [item_name?.trim()||'', unit?.trim()||'',
        parseFloat(ordered_quantity)||0, parseFloat(received_quantity)||0,
        note?.trim()||null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật hàng hóa' })
  }
}

export async function deleteDeliveryItem(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_delivery_item WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa hàng hóa' })
  }
}

// ── Serials ───────────────────────────────────────────────────────────────────

export async function getDeliverySerials(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM contract_in_delivery_serial WHERE delivery_item_id=$1 ORDER BY serial_no',
      [req.params.itemId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh sách serial' })
  }
}

export async function createDeliverySerial(req, res) {
  const { itemId } = req.params
  const { serial_no, note } = req.body
  if (!serial_no?.trim()) return res.status(400).json({ error: 'Số serial không được để trống' })
  try {
    if (await serialExists(pool, TABLE_DELIVERY, serial_no))
      return res.status(409).json({ error: `Serial "${serial_no.trim()}" đã tồn tại ở phía nhập.` })
    const { rows } = await pool.query(
      'INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, note) VALUES ($1,$2,$3) RETURNING *',
      [itemId, serial_no.trim(), note?.trim()||null]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Không thể thêm serial' })
  }
}

export async function deleteDeliverySerial(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_delivery_serial WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa serial' })
  }
}

// Import serials from Excel (1 column: serial numbers)
export async function importDeliverySerials(req, res) {
  const { itemId } = req.params
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const wb  = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const serials = []
    for (let i = 1; i < raw.length; i++) {
      const sn = String(raw[i][0] || '').trim()
      if (sn) serials.push(sn)
    }
    if (!serials.length) return res.status(400).json({ error: 'Không tìm thấy serial trong file' })

    const dupInFile = findDuplicatesInList(serials)
    if (dupInFile.length)
      return res.status(400).json({ error: `File có serial bị lặp: ${dupInFile.join(', ')}`, duplicates: dupInFile })
    const existing = await findExistingSerials(pool, TABLE_DELIVERY, serials)
    if (existing.length)
      return res.status(409).json({ error: `Các serial sau đã tồn tại ở phía nhập: ${existing.join(', ')}`, duplicates: existing })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const inserted = []
      for (const sn of serials) {
        const { rows } = await client.query(
          'INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no) VALUES ($1,$2) RETURNING *',
          [itemId, sn]
        )
        inserted.push(rows[0])
      }
      await client.query('COMMIT')
      res.json({ imported: inserted.length, items: inserted })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('importDeliverySerials:', err)
    res.status(500).json({ error: 'Lỗi import serial: ' + err.message })
  }
}
