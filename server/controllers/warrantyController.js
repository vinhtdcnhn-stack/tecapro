import { pool } from '../db.js'

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════════════════════════

export async function getEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT
         e.*,
         COALESCE(
           json_agg(s ORDER BY s.serial_no) FILTER (WHERE s.id IS NOT NULL),
           '[]'
         ) AS serials
       FROM contract_equipment e
       LEFT JOIN equipment_serial s ON s.equipment_id = e.id
       WHERE e.contract_out_id = $1
       GROUP BY e.id
       ORDER BY e.name, e.brand`,
      [contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getEquipment:', err)
    res.status(500).json({ error: 'Không thể tải danh sách thiết bị' })
  }
}

export async function createEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to, has_serial, note } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_equipment
         (contract_out_id, name, brand, model, quantity, location, warranty_from, warranty_to, has_serial, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [contractId, name.trim(), brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null]
    )
    res.json({ ...rows[0], serials: [] })
  } catch (err) {
    console.error('createEquipment:', err)
    res.status(500).json({ error: 'Không thể thêm thiết bị' })
  }
}

export async function updateEquipment(req, res) {
  const id = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to, has_serial, note } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })
  try {
    const { rows } = await pool.query(
      `UPDATE contract_equipment SET
         name=$1, brand=$2, model=$3, quantity=$4, location=$5,
         warranty_from=$6, warranty_to=$7, has_serial=$8, note=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name.trim(), brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy thiết bị' })
    const serials = await pool.query('SELECT * FROM equipment_serial WHERE equipment_id=$1 ORDER BY serial_no', [id])
    res.json({ ...rows[0], serials: serials.rows })
  } catch (err) {
    console.error('updateEquipment:', err)
    res.status(500).json({ error: 'Không thể cập nhật thiết bị' })
  }
}

export async function deleteEquipment(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM contract_equipment WHERE id=$1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteEquipment:', err)
    res.status(500).json({ error: 'Không thể xóa thiết bị' })
  }
}

// Import từ Excel (nhận parsed JSON từ frontend)
export async function importEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  const items = req.body  // Array of { name, brand, model, quantity, location, warranty_from, warranty_to, serials[] }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Không có dữ liệu để import' })
  }

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

// ═══════════════════════════════════════════════════════════════
// SERIALS
// ═══════════════════════════════════════════════════════════════

export async function getSerials(req, res) {
  const equipmentId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT * FROM equipment_serial WHERE equipment_id=$1 ORDER BY serial_no',
      [equipmentId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải serial' })
  }
}

export async function createSerial(req, res) {
  const equipmentId = parseInt(req.params.id)
  const { serial_no, status, note } = req.body
  if (!serial_no?.trim()) return res.status(400).json({ error: 'Số serial không được để trống' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO equipment_serial (equipment_id, serial_no, status, note) VALUES ($1,$2,$3,$4) RETURNING *',
      [equipmentId, serial_no.trim(), status||'Đang hoạt động', note?.trim()||null]
    )
    await pool.query('UPDATE contract_equipment SET has_serial=true, updated_at=NOW() WHERE id=$1', [equipmentId])
    res.json(rows[0])
  } catch (err) {
    console.error('createSerial:', err)
    res.status(500).json({ error: 'Không thể thêm serial' })
  }
}

export async function updateSerial(req, res) {
  const id = parseInt(req.params.id)
  const { serial_no, status, note } = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE equipment_serial SET serial_no=$1, status=$2, note=$3 WHERE id=$4 RETURNING *',
      [serial_no?.trim()||null, status||'Đang hoạt động', note?.trim()||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy serial' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật serial' })
  }
}

export async function deleteSerial(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM equipment_serial WHERE id=$1', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa serial' })
  }
}

// ═══════════════════════════════════════════════════════════════
// WARRANTY CASES
// ═══════════════════════════════════════════════════════════════

export async function getCases(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT
         wc.*,
         (SELECT COUNT(*) FROM warranty_case_equipment wce WHERE wce.case_id = wc.id) AS equipment_count,
         (SELECT COUNT(*) FROM warranty_activity wa WHERE wa.case_id = wc.id) AS activity_count
       FROM warranty_case wc
       WHERE wc.contract_out_id = $1
       ORDER BY wc.reported_date DESC, wc.id DESC`,
      [contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getCases:', err)
    res.status(500).json({ error: 'Không thể tải danh sách case' })
  }
}

export async function createCase(req, res) {
  const contractId = parseInt(req.params.id)
  const { case_no, title, description, reported_by, reported_date, priority, status, note } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề case không được để trống' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO warranty_case
         (contract_out_id, case_no, title, description, reported_by, reported_date, priority, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [contractId, case_no?.trim()||null, title.trim(),
       description?.trim()||null, reported_by?.trim()||null,
       reported_date||new Date().toISOString().slice(0,10),
       priority||'Bình thường', status||'Tiếp nhận', note?.trim()||null]
    )
    res.json({ ...rows[0], equipment_count: '0', activity_count: '0' })
  } catch (err) {
    console.error('createCase:', err)
    res.status(500).json({ error: 'Không thể tạo case' })
  }
}

export async function updateCase(req, res) {
  const id = parseInt(req.params.id)
  const { case_no, title, description, reported_by, reported_date, priority, status, resolved_date, note } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề case không được để trống' })
  try {
    const { rows } = await pool.query(
      `UPDATE warranty_case SET
         case_no=$1, title=$2, description=$3, reported_by=$4,
         reported_date=$5, priority=$6, status=$7, resolved_date=$8, note=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [case_no?.trim()||null, title.trim(), description?.trim()||null,
       reported_by?.trim()||null, reported_date||null,
       priority||'Bình thường', status||'Tiếp nhận',
       resolved_date||null, note?.trim()||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy case' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateCase:', err)
    res.status(500).json({ error: 'Không thể cập nhật case' })
  }
}

export async function deleteCase(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM warranty_case WHERE id=$1', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa case' })
  }
}

// ═══════════════════════════════════════════════════════════════
// CASE ↔ EQUIPMENT LINKS
// ═══════════════════════════════════════════════════════════════

export async function getCaseEquipment(req, res) {
  const caseId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT
         wce.id AS link_id, wce.note,
         e.id AS equipment_id, e.name, e.brand, e.model,
         s.id AS serial_id, s.serial_no
       FROM warranty_case_equipment wce
       JOIN contract_equipment e ON e.id = wce.equipment_id
       LEFT JOIN equipment_serial s ON s.id = wce.serial_id
       WHERE wce.case_id = $1
       ORDER BY e.name, s.serial_no`,
      [caseId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thiết bị liên quan' })
  }
}

export async function linkEquipment(req, res) {
  const caseId = parseInt(req.params.id)
  const { equipment_id, serial_id, note } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO warranty_case_equipment (case_id, equipment_id, serial_id, note)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [caseId, parseInt(equipment_id), serial_id||null, note?.trim()||null]
    )
    res.json({ success: true, link_id: rows[0].id })
  } catch (err) {
    console.error('linkEquipment:', err)
    res.status(500).json({ error: 'Không thể liên kết thiết bị' })
  }
}

export async function unlinkEquipment(req, res) {
  const linkId = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM warranty_case_equipment WHERE id=$1', [linkId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa liên kết' })
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITIES
// ═══════════════════════════════════════════════════════════════

export async function getActivities(req, res) {
  const caseId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT * FROM warranty_activity WHERE case_id=$1 ORDER BY performed_at DESC',
      [caseId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải nhật ký' })
  }
}

export async function createActivity(req, res) {
  const caseId = parseInt(req.params.id)
  const { activity_type, description, performed_by, performed_at } = req.body
  if (!description?.trim()) return res.status(400).json({ error: 'Mô tả hoạt động không được để trống' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO warranty_activity (case_id, activity_type, description, performed_by, performed_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [caseId, activity_type?.trim()||null, description.trim(),
       performed_by?.trim()||null, performed_at||new Date().toISOString()]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Không thể thêm nhật ký' })
  }
}

export async function deleteActivity(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM warranty_activity WHERE id=$1', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa nhật ký' })
  }
}

// Tất cả activities theo contract (cho tab nhật ký tổng hợp)
export async function getAllActivities(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT wa.*, wc.case_no, wc.title AS case_title
       FROM warranty_activity wa
       JOIN warranty_case wc ON wc.id = wa.case_id
       WHERE wc.contract_out_id = $1
       ORDER BY wa.performed_at DESC`,
      [contractId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải nhật ký tổng hợp' })
  }
}
