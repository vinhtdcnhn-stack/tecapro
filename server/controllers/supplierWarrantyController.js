import { pool } from '../db.js'

const WARRANTY_SELECT = `
  SELECT
    w.*,
    di.item_name          AS di_item_name,
    di.unit               AS di_unit,
    COUNT(ds.id)::int     AS serial_count,
    COALESCE(
      json_agg(
        json_build_object('id', ds.id, 'serial_no', ds.serial_no)
        ORDER BY ds.serial_no
      ) FILTER (WHERE ds.id IS NOT NULL),
      '[]'
    ) AS serials
  FROM contract_in_supplier_warranty w
  LEFT JOIN contract_in_delivery_item di ON di.id = w.delivery_item_id
  LEFT JOIN contract_in_delivery_serial ds ON ds.delivery_item_id = w.delivery_item_id
`

// WHERE phải nằm giữa FROM/JOIN và GROUP BY → chèn điều kiện rồi mới nối phần này
const WARRANTY_GROUP_BY = `
  GROUP BY w.id, di.item_name, di.unit
`

// ── Warranty ──────────────────────────────────────────────────────────────────

export async function getSupplierWarranties(req, res) {
  try {
    const { rows } = await pool.query(
      `${WARRANTY_SELECT} WHERE w.contract_in_id = $1 ${WARRANTY_GROUP_BY} ORDER BY w.id`,
      [req.params.contractInId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getSupplierWarranties:', err)
    res.status(500).json({ error: 'Không thể tải danh sách bảo hành' })
  }
}

export async function createSupplierWarranty(req, res) {
  const { contractInId } = req.params
  const { delivery_item_id, item_name, warranty_period_text, warranty_start, warranty_end, has_guarantee, note } = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_supplier_warranty
        (contract_in_id, delivery_item_id, item_name, warranty_period_text, warranty_start, warranty_end, has_guarantee, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [contractInId, delivery_item_id||null, item_name||'', warranty_period_text||'',
       warranty_start||null, warranty_end||null, has_guarantee||false, note||null]
    )
    const full = await pool.query(`${WARRANTY_SELECT} WHERE w.id = $1 ${WARRANTY_GROUP_BY}`, [rows[0].id])
    res.json(full.rows[0])
  } catch (err) {
    console.error('createSupplierWarranty:', err)
    res.status(500).json({ error: 'Không thể thêm bảo hành' })
  }
}

export async function updateSupplierWarranty(req, res) {
  const { id } = req.params
  const { item_name, warranty_period_text, warranty_start, warranty_end, has_guarantee, note } = req.body
  try {
    await pool.query(`
      UPDATE contract_in_supplier_warranty SET
        item_name=$1, warranty_period_text=$2, warranty_start=$3,
        warranty_end=$4, has_guarantee=$5, note=$6, updated_at=NOW()
      WHERE id=$7`,
      [item_name||'', warranty_period_text||'', warranty_start||null,
       warranty_end||null, has_guarantee||false, note||null, id]
    )
    const full = await pool.query(`${WARRANTY_SELECT} WHERE w.id = $1 ${WARRANTY_GROUP_BY}`, [id])
    if (!full.rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(full.rows[0])
  } catch (err) {
    console.error('updateSupplierWarranty:', err)
    res.status(500).json({ error: 'Không thể cập nhật' })
  }
}

export async function deleteSupplierWarranty(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_supplier_warranty WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa' })
  }
}

// Khởi tạo nhanh từ tất cả delivery items chưa có bảo hành
export async function initWarrantiesFromDelivery(req, res) {
  const { contractInId } = req.params
  try {
    // Lấy tất cả delivery_items của contract_in này chưa có bảo hành
    const { rows: items } = await pool.query(`
      SELECT di.id, di.item_name, b.warranty_period
      FROM contract_in_delivery_item di
      JOIN contract_in_delivery d ON d.id = di.delivery_id
      LEFT JOIN contract_in_boq b ON b.id = di.boq_item_id
      LEFT JOIN contract_in_supplier_warranty w ON w.delivery_item_id = di.id
      WHERE d.contract_in_id = $1 AND w.id IS NULL
    `, [contractInId])

    if (!items.length) return res.json({ created: 0, message: 'Tất cả hàng nhận đã có bảo hành' })

    const created = []
    for (const item of items) {
      const { rows } = await pool.query(`
        INSERT INTO contract_in_supplier_warranty
          (contract_in_id, delivery_item_id, item_name, warranty_period_text)
        VALUES ($1,$2,$3,$4) RETURNING id`,
        [contractInId, item.id, item.item_name, item.warranty_period || '']
      )
      created.push(rows[0].id)
    }
    res.json({ created: created.length })
  } catch (err) {
    console.error('initWarrantiesFromDelivery:', err)
    res.status(500).json({ error: 'Lỗi khởi tạo bảo hành' })
  }
}

// Nhập nhanh: cập nhật warranty_start cho nhiều records cùng lúc
export async function bulkUpdateWarrantyStart(req, res) {
  const { ids, warranty_start, warranty_end } = req.body
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Không có ID' })
  try {
    await pool.query(
      `UPDATE contract_in_supplier_warranty
       SET warranty_start=$1, warranty_end=$2, updated_at=NOW()
       WHERE id = ANY($3)`,
      [warranty_start||null, warranty_end||null, ids]
    )
    res.json({ updated: ids.length })
  } catch (err) {
    console.error('bulkUpdateWarrantyStart:', err)
    res.status(500).json({ error: 'Lỗi cập nhật hàng loạt' })
  }
}

// ── Warranty Claims ───────────────────────────────────────────────────────────

export async function getWarrantyClaims(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, w.item_name AS warranty_item_name
      FROM contract_in_warranty_claim c
      LEFT JOIN contract_in_supplier_warranty w ON w.id = c.warranty_id
      WHERE c.contract_in_id = $1
      ORDER BY c.reported_date DESC, c.id DESC
    `, [req.params.contractInId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải claims' })
  }
}

export async function createWarrantyClaim(req, res) {
  const { contractInId } = req.params
  const { warranty_id, claim_no, title, description, reported_date, status, note } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc' })
  try {
    const { rows } = await pool.query(`
      INSERT INTO contract_in_warranty_claim
        (contract_in_id, warranty_id, claim_no, title, description, reported_date, status, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [contractInId, warranty_id||null, claim_no?.trim()||null, title.trim(),
       description?.trim()||null, reported_date||new Date().toISOString().slice(0,10),
       status||'Tiếp nhận', note?.trim()||null]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('createWarrantyClaim:', err)
    res.status(500).json({ error: 'Không thể tạo claim' })
  }
}

export async function updateWarrantyClaim(req, res) {
  const { id } = req.params
  const { warranty_id, claim_no, title, description, reported_date, status, resolved_date, note } = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE contract_in_warranty_claim SET
        warranty_id=$1, claim_no=$2, title=$3, description=$4,
        reported_date=$5, status=$6, resolved_date=$7, note=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *`,
      [warranty_id||null, claim_no?.trim()||null, title?.trim()||'',
       description?.trim()||null, reported_date||null, status||'Tiếp nhận',
       resolved_date||null, note?.trim()||null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateWarrantyClaim:', err)
    res.status(500).json({ error: 'Không thể cập nhật claim' })
  }
}

export async function deleteWarrantyClaim(req, res) {
  try {
    await pool.query('DELETE FROM contract_in_warranty_claim WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa claim' })
  }
}
