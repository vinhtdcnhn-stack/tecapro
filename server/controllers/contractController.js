import { pool } from '../db.js'
import { insertContractMembers } from './contractMemberController.js'

export async function getAllContracts(req, res) {
  try {
    // Phân quyền xem danh sách: nếu truyền userId thì admin (role=1) xem tất cả,
    // còn lại chỉ xem HĐ mình là thành viên PM (PM chính hoặc đồng PM).
    // Không truyền userId → trả toàn bộ (dùng cho dashboard nội bộ).
    const userId = req.query.userId ? parseInt(req.query.userId) : null
    let restrictPmUserId = null
    if (userId) {
      const { rows: u } = await pool.query('SELECT role FROM app_user WHERE id = $1', [userId])
      if (Number(u[0]?.role) !== 1) restrictPmUserId = userId
    }

    const params = []
    let pmFilter = ''
    if (restrictPmUserId) {
      params.push(restrictPmUserId)
      pmFilter = `
      AND EXISTS (
        SELECT 1 FROM contract_out_member m
        WHERE m.contract_out_id = co.id AND m.user_id = $1 AND m.member_role = 'PM'
      )`
    }

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
        co.exchange_rate,
        co.is_joint_venture,
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
      ${pmFilter}
      ORDER BY co.id, co.contract_date DESC
    `

    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Failed to load contracts:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng' })
  }
}

export async function getContractById(req, res) {
  try {
    const contractId = parseInt(req.params.id)
    
    // Get contract basic info
    const contractSql = `
      SELECT
        co.id,
        co.contract_no,
        co.project_name,
        c.name AS customer_name,
        c.id AS customer_id,
        co.contract_date,
        co.tender_name,
        co.amount_before_vat,
        co.amount_after_vat,
        co.currency_code,
        co.exchange_rate,
        co.payment_term AS terms,
        co.is_joint_venture,
        co.status
      FROM contract_out co
      LEFT JOIN customer c ON c.id = co.customer_id
      WHERE co.id = $1 AND COALESCE(co.is_deleted, false) = false
    `
    
    const contractResult = await pool.query(contractSql, [contractId])
    
    if (contractResult.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy hợp đồng' })
      return
    }
    
    const contract = contractResult.rows[0]
    
    // Get all members grouped by role
    const membersSql = `
      SELECT
        com.member_role,
        au.full_name,
        au.id as user_id,
        com.is_primary
      FROM contract_out_member com
      LEFT JOIN app_user au ON au.id = com.user_id
      WHERE com.contract_out_id = $1
      ORDER BY com.role_rank, au.full_name
    `
    
    const membersResult = await pool.query(membersSql, [contractId])
    
    // Group members by role
    const saleMembers = []
    const pmMembers = []
    const presaleMembers = []
    const technicalMembers = []
    const accountingMembers = []
    const followerMembers = []
    
    const saleMemberIds = []
    const pmMemberIds = []
    const presaleMemberIds = []
    const technicalMemberIds = []
    const accountingMemberIds = []
    const followerMemberIds = []
    
    let pmPrimaryId = null
    
    membersResult.rows.forEach(member => {
      const fullName = member.full_name || '-'
      const userId = member.user_id
      const role = String(member.member_role || '').toUpperCase()
      const isPrimary = member.is_primary

      switch (role) {
        case 'SALE':
          saleMembers.push(fullName)
          if (userId) saleMemberIds.push(userId)
          break

        case 'PM':
          pmMembers.push(fullName)
          if (userId) pmMemberIds.push(userId)
          if (isPrimary && userId) {
            pmPrimaryId = userId
          }
          break

        case 'PRESALE':
          presaleMembers.push(fullName)
          if (userId) presaleMemberIds.push(userId)
          break

        case 'TECHNICAL':
          technicalMembers.push(fullName)
          if (userId) technicalMemberIds.push(userId)
          break

        case 'ACCOUNTANT':
        case 'ACCOUNTING':
          accountingMembers.push(fullName)
          if (userId) accountingMemberIds.push(userId)
          break

        case 'FOLLOWER':
          followerMembers.push(fullName)
          if (userId) followerMemberIds.push(userId)
          break
      }
    })
    
    res.json({
      ...contract,
      sale_members: saleMembers,
      sale_member_ids: saleMemberIds,
      pm_members: pmMembers,
      pm_member_ids: pmMemberIds,
      pm_primary_id: pmPrimaryId,
      presale_members: presaleMembers,
      presale_member_ids: presaleMemberIds,
      technical_members: technicalMembers,
      technical_member_ids: technicalMemberIds,
      accounting_members: accountingMembers,
      accounting_member_ids: accountingMemberIds,
      follower_members: followerMembers,
      follower_member_ids: followerMemberIds
    })
  } catch (err) {
    console.error('Failed to load contract details:', err)
    res.status(500).json({ error: 'Không thể tải thông tin hợp đồng' })
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
    amount_after_vat,
    currency_code,
    exchange_rate,
    terms,
    status,
    is_joint_venture,
    pm_primary_id,
    pm_team,
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
          exchange_rate,
          payment_term,
          status,
          is_joint_venture,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
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
        exchange_rate ? parseFloat(exchange_rate) : null,
        terms?.trim() || null,
        status || 'Pending',
        is_joint_venture === true
      ])

      const contractId = contractResult.rows[0].id

      await insertContractMembers(client, contractId, { pm_primary_id, pm_team, sale_team, presale_team, technical_team, accounting_team, followers })

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

// Cập nhật hợp đồng
export async function updateContract(req, res) {
  const contractId = req.params.id
  const {
    contract_no,
    contract_date,
    project_name,
    customer_id,
    tender_name,
    currency_code,
    exchange_rate,
    terms,
    status,
    is_joint_venture,
    pm_primary_id,
    pm_team,
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
    // Kiểm tra trùng số hợp đồng (trừ chính nó)
    const checkResult = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1 AND id != $2',
      [String(contract_no).trim().toUpperCase(), parseInt(contractId)]
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

      // Update hợp đồng (amount_before_vat/after_vat lấy từ bảng giá BOQ, không sửa ở đây)
      const updateContractSql = `
        UPDATE contract_out SET
          contract_no = $1,
          contract_date = $2,
          project_name = $3,
          customer_id = $4,
          tender_name = $5,
          currency_code = $6,
          exchange_rate = $7,
          payment_term = $8,
          status = $9,
          is_joint_venture = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING id
      `

      await client.query(updateContractSql, [
        String(contract_no).trim().toUpperCase(),
        contract_date,
        project_name.trim(),
        parseInt(customer_id),
        tender_name?.trim() || null,
        currency_code || 'VND',
        exchange_rate ? parseFloat(exchange_rate) : null,
        terms?.trim() || null,
        status || 'Pending',
        is_joint_venture === true,
        parseInt(contractId)
      ])

      await client.query('DELETE FROM contract_out_member WHERE contract_out_id = $1', [parseInt(contractId)])
      await insertContractMembers(client, parseInt(contractId), { pm_primary_id, pm_team, sale_team, presale_team, technical_team, accounting_team, followers })

      await client.query('COMMIT')

      res.json({
        success: true,
        id: parseInt(contractId),
        contract_no: String(contract_no).trim().toUpperCase()
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Error updating contract:', err)

    if (err.code === '23505') {
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật hợp đồng.'
    })
  }
}
