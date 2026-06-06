import { pool } from '../db.js'

// Tra cứu bảo hành theo số serial — nối phía bán (HĐ bán → khách hàng) và
// phía nhập (HĐ nhập → nhà cung cấp) qua CHÍNH chuỗi serial_no.
export async function lookupSerial(req, res) {
  const serial = (req.query.serial || '').trim()
  if (!serial) return res.status(400).json({ error: 'Chưa nhập số serial' })

  try {
    // Phía bán: serial → thiết bị → hợp đồng bán → khách hàng
    const saleQ = pool.query(
      `SELECT
         s.id              AS serial_id,
         s.serial_no,
         s.status,
         s.warranty_from,
         s.warranty_to,
         s.replaced_at,
         ns.serial_no      AS replaced_by_serial_no,
         e.name            AS eq_name,
         e.brand,
         e.model,
         e.warranty_from   AS eq_warranty_from,
         e.warranty_to     AS eq_warranty_to,
         co.id             AS contract_out_id,
         co.contract_no,
         co.project_name,
         co.tender_name,
         cust.name         AS customer_name
       FROM equipment_serial s
       JOIN contract_equipment e ON e.id = s.equipment_id
       JOIN contract_out co      ON co.id = e.contract_out_id
       LEFT JOIN customer cust   ON cust.id = co.customer_id
       LEFT JOIN equipment_serial ns ON ns.id = s.replaced_by_serial_id
       WHERE LOWER(TRIM(s.serial_no)) = LOWER($1)
       ORDER BY s.id`,
      [serial]
    )

    // Phía nhập: serial nhận hàng → đợt nhận → HĐ nhập → NCC, kèm bảo hành NCC
    const importQ = pool.query(
      `SELECT
         ds.id                  AS serial_id,
         ds.serial_no,
         ds.status,
         ds.replaced_at,
         nds.serial_no          AS replaced_by_serial_no,
         ci.id                  AS contract_in_id,
         ci.contract_no,
         ci.goods_type,
         sup.name               AS supplier_name,
         d.batch_name,
         d.receive_date,
         di.item_name,
         w.warranty_period_text,
         w.warranty_start,
         w.warranty_end
       FROM contract_in_delivery_serial ds
       JOIN contract_in_delivery_item di ON di.id = ds.delivery_item_id
       JOIN contract_in_delivery d       ON d.id = di.delivery_id
       JOIN contract_in ci               ON ci.id = d.contract_in_id
       LEFT JOIN supplier sup            ON sup.id = ci.supplier_id
       LEFT JOIN contract_in_supplier_warranty w ON w.delivery_item_id = di.id
       LEFT JOIN contract_in_delivery_serial nds ON nds.id = ds.replaced_by_serial_id
       WHERE LOWER(TRIM(ds.serial_no)) = LOWER($1)
       ORDER BY ci.id`,
      [serial]
    )

    const [sale, imp] = await Promise.all([saleQ, importQ])
    res.json({ serial, sale: sale.rows, import: imp.rows })
  } catch (err) {
    console.error('lookupSerial:', err)
    res.status(500).json({ error: 'Không thể tra cứu serial' })
  }
}

// Thay thế 1 serial sau bảo hành: tạo serial mới (cùng thiết bị, kế thừa máy cha),
// đánh dấu serial cũ "Đã thay thế" và liên kết cũ → mới.
export async function replaceSerial(req, res) {
  const oldId = parseInt(req.params.id)
  const { new_serial_no, warranty_from, warranty_to, note, replaced_at } = req.body
  if (!new_serial_no?.trim()) return res.status(400).json({ error: 'Chưa nhập serial mới' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: oldRows } = await client.query(
      'SELECT * FROM equipment_serial WHERE id = $1 FOR UPDATE',
      [oldId]
    )
    const oldSerial = oldRows[0]
    if (!oldSerial) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy serial cần thay thế' })
    }
    if (oldSerial.replaced_by_serial_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Serial này đã được thay thế trước đó' })
    }

    const { rows: newRows } = await client.query(
      `INSERT INTO equipment_serial
         (equipment_id, serial_no, status, note, warranty_from, warranty_to, parent_serial_id)
       VALUES ($1,$2,'Đang hoạt động',$3,$4,$5,$6) RETURNING *`,
      [oldSerial.equipment_id, new_serial_no.trim(), note?.trim() || null,
       warranty_from || null, warranty_to || null, oldSerial.parent_serial_id || null]
    )
    const newSerial = newRows[0]

    const { rows: updatedOld } = await client.query(
      `UPDATE equipment_serial
         SET status = 'Đã thay thế', replaced_by_serial_id = $1, replaced_at = $2
       WHERE id = $3 RETURNING *`,
      [newSerial.id, replaced_at || new Date().toISOString().slice(0, 10), oldId]
    )

    await client.query('COMMIT')
    res.json({ old: updatedOld[0], new: newSerial })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('replaceSerial:', err)
    res.status(500).json({ error: 'Không thể thay thế serial' })
  } finally {
    client.release()
  }
}

// Thay thế serial phía NHẬP (contract_in_delivery_serial). Bảo hành lấy theo loại hàng
// (contract_in_supplier_warranty) nên không lưu hạn riêng trên serial.
export async function replaceDeliverySerial(req, res) {
  const oldId = parseInt(req.params.id)
  const { new_serial_no, note, replaced_at } = req.body
  if (!new_serial_no?.trim()) return res.status(400).json({ error: 'Chưa nhập serial mới' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: oldRows } = await client.query(
      'SELECT * FROM contract_in_delivery_serial WHERE id = $1 FOR UPDATE',
      [oldId]
    )
    const oldSerial = oldRows[0]
    if (!oldSerial) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy serial cần thay thế' })
    }
    if (oldSerial.replaced_by_serial_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Serial này đã được thay thế trước đó' })
    }

    const { rows: newRows } = await client.query(
      `INSERT INTO contract_in_delivery_serial (delivery_item_id, serial_no, status, note)
       VALUES ($1,$2,'Đang hoạt động',$3) RETURNING *`,
      [oldSerial.delivery_item_id, new_serial_no.trim(), note?.trim() || null]
    )
    const newSerial = newRows[0]

    const { rows: updatedOld } = await client.query(
      `UPDATE contract_in_delivery_serial
         SET status = 'Đã thay thế', replaced_by_serial_id = $1, replaced_at = $2
       WHERE id = $3 RETURNING *`,
      [newSerial.id, replaced_at || new Date().toISOString().slice(0, 10), oldId]
    )

    await client.query('COMMIT')
    res.json({ old: updatedOld[0], new: newSerial })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('replaceDeliverySerial:', err)
    res.status(500).json({ error: 'Không thể thay thế serial' })
  } finally {
    client.release()
  }
}
