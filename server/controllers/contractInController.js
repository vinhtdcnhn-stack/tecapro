import { pool } from '../db.js'

// Giá trị HĐ nhập do bảng giá mua quyết định (xem syncContractInTotal). Tính thẳng
// từ tổng BOQ ở đây để list/header luôn khớp bảng giá, kể cả dữ liệu cũ chưa sync
// (cột ci.amount có thể còn giá trị nhập tay cũ). Alias "amount" đặt SAU ci.* để
// đè cột amount gốc trong kết quả; fallback về ci.amount khi HĐ chưa có dòng BOQ nào.
const BASE_SELECT = `
  SELECT
    ci.*,
    COALESCE(
      (SELECT SUM(b.amount_after_vat) FROM contract_in_boq b WHERE b.contract_in_id = ci.id),
      ci.amount
    ) AS amount,
    s.name  AS supplier_name,
    s.code  AS supplier_code
  FROM contract_in ci
  LEFT JOIN supplier s ON s.id = ci.supplier_id
`

export async function getContractIns(req, res) {
  const contractOutId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT} WHERE ci.contract_out_id = $1 ORDER BY ci.contract_date DESC, ci.id DESC`,
      [contractOutId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getContractIns:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng nhập' })
  }
}

export async function createContractIn(req, res) {
  const contractOutId = parseInt(req.params.id)
  const { contract_no, goods_type, contract_date, supplier_id, amount, currency_code, exchange_rate, purchase_type, status, note } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_in
         (contract_out_id, contract_no, goods_type, contract_date, supplier_id, amount, currency_code, exchange_rate, purchase_type, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [contractOutId, contract_no?.trim()||null, goods_type?.trim()||null,
       contract_date||null, supplier_id||null,
       parseFloat(amount)||0, currency_code||'VND',
       exchange_rate ? parseFloat(exchange_rate) : null,
       purchase_type||'Trong nước', status||'Active', note?.trim()||null]
    )
    const full = await pool.query(`${BASE_SELECT} WHERE ci.id = $1`, [rows[0].id])
    res.json(full.rows[0])
  } catch (err) {
    console.error('createContractIn:', err)
    res.status(500).json({ error: 'Không thể tạo hợp đồng nhập' })
  }
}

export async function updateContractIn(req, res) {
  const id = parseInt(req.params.id)
  // amount KHÔNG nhận từ body: giá trị HĐ nhập do bảng giá mua quyết định (syncContractInTotal).
  const { contract_no, goods_type, contract_date, supplier_id, currency_code, exchange_rate, purchase_type, status, note } = req.body
  try {
    await pool.query(
      `UPDATE contract_in SET
         contract_no=$1, goods_type=$2, contract_date=$3, supplier_id=$4,
         currency_code=$5, exchange_rate=$6, purchase_type=$7,
         status=$8, note=$9, updated_at=NOW()
       WHERE id=$10`,
      [contract_no?.trim()||null, goods_type?.trim()||null,
       contract_date||null, supplier_id||null,
       currency_code||'VND',
       exchange_rate ? parseFloat(exchange_rate) : null,
       purchase_type||'Trong nước', status||'Active', note?.trim()||null, id]
    )
    const full = await pool.query(`${BASE_SELECT} WHERE ci.id = $1`, [id])
    if (!full.rows[0]) return res.status(404).json({ error: 'Không tìm thấy hợp đồng nhập' })
    res.json(full.rows[0])
  } catch (err) {
    console.error('updateContractIn:', err)
    res.status(500).json({ error: 'Không thể cập nhật hợp đồng nhập' })
  }
}

export async function deleteContractIn(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM contract_in WHERE id=$1', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa hợp đồng nhập' })
  }
}
