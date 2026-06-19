import { pool } from '../db.js'
import { TABLE_EQUIPMENT, TABLE_DELIVERY, serialExists, findExistingSerials } from './serialUtils.js'
import { pullImportComponents } from './importComponentSync.js'
import { notifyAction, pmUserIds, contractLabel } from '../services/notify.js'

// POST /serials/check-import — kiểm tra danh sách serial có trong hệ thống NHẬP chưa
// (contract_in_delivery_serial, đối chiếu toàn hệ thống, không phân biệt hoa/thường).
// Trả { missing, missing_count }: các serial CHƯA có ở phía nhập (đã loại trùng).
export async function checkImportSerials(req, res) {
  const raw = Array.isArray(req.body?.serials) ? req.body.serials : []
  const cleaned = raw.map(s => String(s ?? '').trim()).filter(Boolean)
  if (!cleaned.length) return res.json({ missing: [], missing_count: 0 })
  try {
    const present = await findExistingSerials(pool, TABLE_DELIVERY, cleaned)
    const presentSet = new Set(present.map(s => s.trim().toLowerCase()))
    const seen = new Set()
    const missing = []
    for (const s of cleaned) {
      const k = s.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      if (!presentSet.has(k)) missing.push(s)
    }
    res.json({ missing, missing_count: missing.length })
  } catch (err) {
    console.error('checkImportSerials:', err)
    res.status(500).json({ error: 'Không thể kiểm tra serial trong hệ thống nhập' })
  }
}

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

// Chuẩn hóa số nguyên tùy chọn (id biên bản, số tháng) → int | null.
const intOrNull = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export async function createEquipment(req, res) {
  const contractId = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months, delivery_id } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_equipment
         (contract_out_id, name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months, delivery_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [contractId, name.trim(), brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null,
       intOrNull(warranty_bb_id), intOrNull(warranty_months), intOrNull(delivery_id)]
    )
    res.json({ ...rows[0], serials: [] })
  } catch (err) {
    console.error('createEquipment:', err)
    res.status(500).json({ error: 'Không thể thêm thiết bị' })
  }
}

export async function updateEquipment(req, res) {
  const id = parseInt(req.params.id)
  const { name, brand, model, quantity, location, warranty_from, warranty_to,
          has_serial, note, warranty_bb_id, warranty_months } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được để trống' })
  try {
    const { rows } = await pool.query(
      `UPDATE contract_equipment SET
         name=$1, brand=$2, model=$3, quantity=$4, location=$5,
         warranty_from=$6, warranty_to=$7, has_serial=$8, note=$9,
         warranty_bb_id=$10, warranty_months=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name.trim(), brand?.trim()||null, model?.trim()||null,
       parseFloat(quantity)||1, location?.trim()||null,
       warranty_from||null, warranty_to||null, has_serial||false, note?.trim()||null,
       intOrNull(warranty_bb_id), intOrNull(warranty_months), id]
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

// GET /serials/:id/components — linh kiện (serial con) của một serial MÁY phía bán.
// Linh kiện = equipment_serial có parent_serial_id = serial máy; type_name = tên loại
// thiết bị linh kiện (contract_equipment.name). Trả { machine, components } khớp định
// dạng của getSerialComponents phía nhập để dùng chung SerialComponentsModal.
export async function getSerialComponents(req, res) {
  const id = parseInt(req.params.id)
  try {
    const machine = await pool.query(
      'SELECT id, serial_no, status FROM equipment_serial WHERE id=$1', [id]
    )
    if (!machine.rows[0]) return res.status(404).json({ error: 'Không tìm thấy serial' })
    const { rows } = await pool.query(
      `SELECT s.id, s.serial_no, s.status, s.note, e.name AS type_name
         FROM equipment_serial s
         JOIN contract_equipment e ON e.id = s.equipment_id
        WHERE s.parent_serial_id = $1
        ORDER BY e.name, s.id`,
      [id]
    )
    res.json({ machine: machine.rows[0], components: rows })
  } catch (err) {
    console.error('getSerialComponents:', err)
    res.status(500).json({ error: 'Không thể tải linh kiện của máy' })
  }
}

export async function createSerial(req, res) {
  const equipmentId = parseInt(req.params.id)
  const { serial_no, status, note, warranty_from, warranty_to, parent_serial_id } = req.body
  if (!serial_no?.trim()) return res.status(400).json({ error: 'Số serial không được để trống' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (await serialExists(client, TABLE_EQUIPMENT, serial_no)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Serial "${serial_no.trim()}" đã tồn tại ở phía bán ra.` })
    }
    // Lấy hợp đồng + hạn BH của thiết bị để: (1) biết contract khi kéo linh kiện,
    // (2) tính hạn hiệu lực của máy mà linh kiện sẽ kế thừa.
    const eq = await client.query(
      'SELECT contract_out_id, warranty_from, warranty_to, location, delivery_id FROM contract_equipment WHERE id=$1', [equipmentId])
    if (!eq.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy thiết bị' })
    }
    const contractId = eq.rows[0].contract_out_id

    const { rows } = await client.query(
      `INSERT INTO equipment_serial (equipment_id, serial_no, status, note, warranty_from, warranty_to, parent_serial_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [equipmentId, serial_no.trim(), status||'Đang hoạt động', note?.trim()||null,
       warranty_from||null, warranty_to||null, parent_serial_id||null]
    )
    const saved = rows[0]
    await client.query('UPDATE contract_equipment SET has_serial=true, updated_at=NOW() WHERE id=$1', [equipmentId])

    // Tự kéo linh kiện đi kèm từ phía nhập. Hạn linh kiện kế thừa hạn hiệu lực của máy
    // (hạn riêng serial nếu có, không thì hạn của thiết bị).
    const effFrom = saved.warranty_from || eq.rows[0].warranty_from
    const effTo   = saved.warranty_to   || eq.rows[0].warranty_to
    const pulled = await pullImportComponents(client, contractId, [{
      serialId: saved.id, serialNo: saved.serial_no, warrantyFrom: effFrom, warrantyTo: effTo,
      location: eq.rows[0].location, deliveryId: eq.rows[0].delivery_id,
    }])

    await client.query('COMMIT')
    res.json({ ...saved, pulled_components: pulled.added })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('createSerial:', err)
    res.status(500).json({ error: 'Không thể thêm serial' })
  } finally {
    client.release()
  }
}

export async function updateSerial(req, res) {
  const id = parseInt(req.params.id)
  const { serial_no, status, note, warranty_from, warranty_to, parent_serial_id } = req.body
  try {
    if (serial_no?.trim() && await serialExists(pool, TABLE_EQUIPMENT, serial_no, id))
      return res.status(409).json({ error: `Serial "${serial_no.trim()}" đã tồn tại ở phía bán ra.` })
    const { rows } = await pool.query(
      `UPDATE equipment_serial SET
         serial_no=$1, status=$2, note=$3, warranty_from=$4, warranty_to=$5, parent_serial_id=$6
       WHERE id=$7 RETURNING *`,
      [serial_no?.trim()||null, status||'Đang hoạt động', note?.trim()||null,
       warranty_from||null, warranty_to||null,
       parent_serial_id||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy serial' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateSerial:', err)
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

// Xóa HÀNG LOẠT serial. Body: { ids: [...] }
export async function bulkDeleteSerials(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'Chưa chọn dòng nào' })
  try {
    const { rowCount } = await pool.query('DELETE FROM equipment_serial WHERE id = ANY($1::int[])', [ids])
    res.json({ success: true, count: rowCount })
  } catch (err) {
    console.error('bulkDeleteSerials:', err)
    res.status(500).json({ error: 'Không thể xóa các serial đã chọn' })
  }
}

// Sửa bảo hành HÀNG LOẠT (1 truy vấn). Để trống trường nào thì giữ nguyên trường đó.
// Body: { ids:[...], warranty_from?, warranty_to?, warranty_months?, warranty_bb_id? }
//   - warranty_months: cộng từ BH từ (mới nếu có trong cùng thao tác, không thì BH từ hiện có của từng dòng).
//   - warranty_bb_id / warranty_months chỉ lưu cho bảng thiết bị (equipment_serial không có cột này).
async function bulkWarranty(table, req, res) {
  const { ids, warranty_from, warranty_to, warranty_months, warranty_bb_id } = req.body
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Chưa chọn dòng nào' })
  const isEquip = table === 'contract_equipment'
  const sets = [], params = []
  let i = 1

  // BH từ — mặc định giữ cột hiện có; nếu có giá trị mới thì cập nhật và dùng làm mốc cho số tháng.
  let fromExpr = 'warranty_from'
  if (warranty_from) {
    params.push(warranty_from)
    fromExpr = `$${i++}`
    sets.push(`warranty_from=${fromExpr}`)
  }

  // BH đến — ưu tiên số tháng (cộng từ mốc BH từ), nếu không thì nhận ngày trực tiếp.
  const months = parseInt(warranty_months, 10)
  if (Number.isFinite(months)) {
    params.push(months)
    sets.push(`warranty_to = (${fromExpr})::date + ($${i++} * INTERVAL '1 month')`)
    if (isEquip) { params.push(months); sets.push(`warranty_months=$${i++}`) }
  } else if (warranty_to) {
    params.push(warranty_to)
    sets.push(`warranty_to=$${i++}`)
    if (isEquip) sets.push('warranty_months=NULL')
  }

  // Mốc biên bản — chỉ khi đang đặt lại BH từ (id biên bản, hoặc null để xóa mốc cũ).
  if (isEquip && warranty_from && warranty_bb_id !== undefined) {
    const bb = parseInt(warranty_bb_id, 10)
    params.push(Number.isFinite(bb) ? bb : null)
    sets.push(`warranty_bb_id=$${i++}`)
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Chưa nhập ngày để cập nhật' })
  if (isEquip) sets.push('updated_at=NOW()')
  params.push(ids.map(Number))
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ANY($${i})`, params
    )
    res.json({ success: true, updated: rowCount })
  } catch (err) {
    console.error('bulkWarranty:', err)
    res.status(500).json({ error: 'Không thể cập nhật bảo hành hàng loạt' })
  }
}

export const bulkWarrantySerials   = (req, res) => bulkWarranty('equipment_serial', req, res)
export const bulkWarrantyEquipment = (req, res) => bulkWarranty('contract_equipment', req, res)

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

    // Case bảo hành mới → báo PM hợp đồng (việc cần xử lý 🔔). Bỏ qua người tự tạo.
    const pms = (await pmUserIds(contractId)).filter(uid => uid !== req.user?.id)
    if (pms.length) {
      const label = await contractLabel(contractId)
      notifyAction(pms, `Có case bảo hành mới cần xử lý ở HĐ ${label}: "${title.trim()}"`)
    }
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
