import { pool } from '../db.js'

// ==================== CONTRACT OUT CONTROLLER ====================

export async function getAllContracts(req, res) {
  const { rows } = await pool.query(`
    SELECT
      co.id,
      co.contract_no,
      co.project_name,
      c.name as customer_name,
      co.contract_date,
      co.tender_name,
      co.amount_before_vat,
      co.amount_after_vat,
      co.exchange_rate,
      co.status,
      (SELECT member_role FROM contract_out_member WHERE contract_out_id = co.id AND is_primary = true LIMIT 1) as primary_pm,
      co.created_at
    FROM contract_out co
    LEFT JOIN customer c ON co.customer_id = c.id
    WHERE co.is_deleted = false
    ORDER BY co.id DESC
  `)

  res.json(rows)
}

export async function getContractById(req, res) {
  const id = req.params.id

  const { rows } = await pool.query(
    `
    SELECT
      co.*,
      c.name as customer_name
    FROM contract_out co
    LEFT JOIN customer c ON co.customer_id = c.id
    WHERE co.id = $1 AND co.is_deleted = false
    `,
    [id]
  )

  const contract = rows[0]

  if (!contract) {
    res.status(404).json({
      error: 'Không tìm thấy hợp đồng.'
    })
    return
  }

  // Get members
  const { rows: members } = await pool.query(
    `
    SELECT * FROM contract_out_member
    WHERE contract_out_id = $1
    ORDER BY role_rank ASC
    `,
    [id]
  )

  contract.members = members
  res.json(contract)
}

export async function createContract(req, res) {
  const {
    contract_no,
    contract_date,
    pakd_no,
    uq_no,
    customer_id,
    tender_name,
    project_name,
    contract_type,
    currency_code,
    exchange_rate,
    amount_before_vat,
    amount_after_vat,
    payment_term,
    status,
    created_by,
    members
  } = req.body

  if (!contract_no || !project_name) {
    res.status(400).json({
      error: 'Số hợp đồng và tên dự án là bắt buộc.'
    })
    return
  }

  const client = await pool.getClient()
  
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `
      INSERT INTO contract_out (
        contract_no,
        contract_date,
        pakd_no,
        uq_no,
        customer_id,
        tender_name,
        project_name,
        contract_type,
        currency_code,
        exchange_rate,
        amount_before_vat,
        amount_after_vat,
        payment_term,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
      `,
      [
        contract_no?.trim() || null,
        contract_date || null,
        pakd_no?.trim() || null,
        uq_no?.trim() || null,
        customer_id || null,
        tender_name?.trim() || null,
        project_name?.trim() || null,
        contract_type?.trim() || null,
        currency_code?.trim() || 'VND',
        exchange_rate || 1,
        amount_before_vat || null,
        amount_after_vat || null,
        payment_term || null,
        status || null,
        created_by || null
      ]
    )

    const contractId = rows[0].id

    // Insert members if provided
    if (members && Array.isArray(members)) {
      for (const member of members) {
        await client.query(
          `
          INSERT INTO contract_out_member (
            contract_out_id,
            user_id,
            member_role,
            is_primary,
            role_rank
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            contractId,
            member.user_id,
            member.member_role,
            member.is_primary || false,
            member.role_rank || 1
          ]
        )
      }
    }

    await client.query('COMMIT')

    res.json({
      success: true,
      id: contractId
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Lỗi khi tạo contract_out:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo hợp đồng.'
    })
  } finally {
    client.release()
  }
}

export async function updateContract(req, res) {
  const id = req.params.id
  const {
    contract_no,
    contract_date,
    pakd_no,
    uq_no,
    customer_id,
    tender_name,
    project_name,
    contract_type,
    currency_code,
    exchange_rate,
    amount_before_vat,
    amount_after_vat,
    payment_term,
    status,
    updated_by,
    members
  } = req.body

  if (!contract_no || !project_name) {
    res.status(400).json({
      error: 'Số hợp đồng và tên dự án là bắt buộc.'
    })
    return
  }

  const client = await pool.getClient()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `
      UPDATE contract_out
      SET
        contract_no = $1,
        contract_date = $2,
        pakd_no = $3,
        uq_no = $4,
        customer_id = $5,
        tender_name = $6,
        project_name = $7,
        contract_type = $8,
        currency_code = $9,
        exchange_rate = $10,
        amount_before_vat = $11,
        amount_after_vat = $12,
        payment_term = $13,
        status = $14,
        updated_by = $15,
        updated_at = NOW()
      WHERE id = $16
      RETURNING id
      `,
      [
        contract_no?.trim() || null,
        contract_date || null,
        pakd_no?.trim() || null,
        uq_no?.trim() || null,
        customer_id || null,
        tender_name?.trim() || null,
        project_name?.trim() || null,
        contract_type?.trim() || null,
        currency_code?.trim() || 'VND',
        exchange_rate || 1,
        amount_before_vat || null,
        amount_after_vat || null,
        payment_term || null,
        status || null,
        updated_by || null,
        id
      ]
    )

    if (rows.length === 0) {
      await client.query('ROLLBACK')
      res.status(404).json({
        error: 'Không tìm thấy hợp đồng.'
      })
      return
    }

    // Update members if provided - delete old and insert new
    if (members && Array.isArray(members)) {
      await client.query(
        'DELETE FROM contract_out_member WHERE contract_out_id = $1',
        [id]
      )

      for (const member of members) {
        await client.query(
          `
          INSERT INTO contract_out_member (
            contract_out_id,
            user_id,
            member_role,
            is_primary,
            role_rank
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            id,
            member.user_id,
            member.member_role,
            member.is_primary || false,
            member.role_rank || 1
          ]
        )
      }
    }

    await client.query('COMMIT')

    res.json({
      success: true,
      id: id
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Lỗi khi cập nhật contract_out:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật hợp đồng.'
    })
  } finally {
    client.release()
  }
}

export async function deleteContract(req, res) {
  const id = req.params.id

  try {
    const { rowCount } = await pool.query(
      `
      UPDATE contract_out
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    )

    if (rowCount === 0) {
      res.status(404).json({
        error: 'Không tìm thấy hợp đồng.'
      })
      return
    }

    res.json({
      success: true
    })
  } catch (err) {
    console.error('Lỗi khi xóa contract_out:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi xóa hợp đồng.'
    })
  }
}
