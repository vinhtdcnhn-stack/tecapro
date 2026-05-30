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

// Kiểm tra trùng số hợp đồng
export async function checkContractNoDuplicate(req, res) {
  const contractNo = String(req.body?.contract_no ?? '').trim().toUpperCase()

  if (!contractNo) {
    res.status(400).json({
      exists: false,
      error: 'Số hợp đồng không được để trống.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1',
      [contractNo]
    )

    res.json({
      exists: rows.length > 0
    })
  } catch (err) {
    console.error('Error checking contract_no duplicate:', err)
    res.status(500).json({
      exists: false,
      error: 'Có lỗi xảy ra khi kiểm tra.'
    })
  }
}

// Tạo hợp đồng mới
export async function createContract(req, res) {
  const {
    contract_no,
    contract_date,
    project_name,
    customer_id,
    tender_name,
    amount_before_vat,
    vat_percent,
    amount_after_vat,
    currency_code,
    terms,
    status,
    pm_primary_id,
    sale_team,
    presale_team,
    technical_team,
    accounting_team,
    followers
  } = req.body

  // Validation các trường bắt buộc
  if (!contract_no || !contract_date || !project_name || !customer_id) {
    res.status(400).json({
      error: 'Các trường Số hợp đồng, Ngày ký, Tên dự án và Chủ đầu tư là bắt buộc.'
    })
    return
  }

  try {
    // Kiểm tra trùng số hợp đồng lần nữa ở backend
    const checkResult = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1',
      [String(contract_no).trim().toUpperCase()]
    )

    if (checkResult.rows.length > 0) {
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    // Bắt đầu transaction
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Insert hợp đồng
      const insertContractSql = `
        INSERT INTO contract_out (
          contract_no,
          contract_date,
          project_name,
          customer_id,
          tender_name,
          amount_before_vat,
          amount_after_vat,
          currency_code,
          payment_term,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING id
      `

      const contractResult = await client.query(insertContractSql, [
        String(contract_no).trim().toUpperCase(),
        contract_date,
        project_name.trim(),
        parseInt(customer_id),
        tender_name?.trim() || null,
        parseFloat(amount_before_vat) || 0,
        parseFloat(amount_after_vat) || 0,
        currency_code || 'VND',
        terms?.trim() || null,
        status || 'Pending'
      ])

      const contractId = contractResult.rows[0].id

      // Thêm PM chính (primary)
      if (pm_primary_id) {
        const insertPMSql = `
          INSERT INTO contract_out_member (
            contract_out_id,
            user_id,
            member_role,
            is_primary,
            role_rank,
            created_at
          )
          VALUES ($1, $2, 'PM', true, 1, NOW())
        `
        await client.query(insertPMSql, [contractId, pm_primary_id])
      }

      // Thêm Sale team
      if (sale_team && Array.isArray(sale_team) && sale_team.length > 0) {
        for (const userId of sale_team) {
          await client.query(
            `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at)
             VALUES ($1, $2, 'Sale', false, 2, NOW())`,
            [contractId, userId]
          )
        }
      }

      // Thêm Presale team
      if (presale_team && Array.isArray(presale_team) && presale_team.length > 0) {
        for (const userId of presale_team) {
          await client.query(
            `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at)
             VALUES ($1, $2, 'Presale', false, 3, NOW())`,
            [contractId, userId]
          )
        }
      }

      // Thêm Technical team
      if (technical_team && Array.isArray(technical_team) && technical_team.length > 0) {
        for (const userId of technical_team) {
          await client.query(
            `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at)
             VALUES ($1, $2, 'Technical', false, 4, NOW())`,
            [contractId, userId]
          )
        }
      }

      // Thêm Accounting team
      if (accounting_team && Array.isArray(accounting_team) && accounting_team.length > 0) {
        for (const userId of accounting_team) {
          await client.query(
            `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at)
             VALUES ($1, $2, 'Accounting', false, 5, NOW())`,
            [contractId, userId]
          )
        }
      }

      // Thêm Followers
      if (followers && Array.isArray(followers) && followers.length > 0) {
        for (const userId of followers) {
          await client.query(
            `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at)
             VALUES ($1, $2, 'Follower', false, 6, NOW())`,
            [contractId, userId]
          )
        }
      }

      await client.query('COMMIT')

      res.json({
        success: true,
        id: contractId,
        contract_no: String(contract_no).trim().toUpperCase()
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Error creating contract:', err)

    if (err.code === '23505') {
      // Unique constraint violation
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo hợp đồng.'
    })
  }
}
