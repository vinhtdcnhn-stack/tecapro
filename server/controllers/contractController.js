import { pool } from '../db.js'

export async function getAllContracts(req, res) {
  try {
    const sql = `
      SELECT DISTINCT ON (co.id)
        co.id,
        co.contract_no,
        co.project_name,
        c.name AS customer_name,
        co.contract_date,
        co.tender_name,
        co.amount_before_vat,
        co.amount_after_vat,
        co.currency_code,
        COALESCE(au.full_name, '-') AS pm_name,
        co.status
      FROM contract_out co
      LEFT JOIN customer c ON c.id = co.customer_id
      LEFT JOIN (
        SELECT 
          com.contract_out_id,
          com.user_id,
          com.role_rank,
          ROW_NUMBER() OVER (PARTITION BY com.contract_out_id ORDER BY com.role_rank ASC) as rn
        FROM contract_out_member com
        WHERE com.member_role = 'PM' AND com.is_primary = true
      ) com ON com.contract_out_id = co.id AND com.rn = 1
      LEFT JOIN app_user au ON au.id = com.user_id
      WHERE COALESCE(co.is_deleted, false) = false
      ORDER BY co.id, co.contract_date DESC
    `
    
    const result = await pool.query(sql)
    res.json(result.rows)
  } catch (err) {
    console.error('Failed to load contracts:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng' })
  }
}
