import { pool } from '../db.js'

// ==================== CUSTOMER CONTROLLER ====================

export async function getAllCustomers(req, res) {
  const { rows } = await pool.query(`
    SELECT
      id,
      code,
      name,
      tax_code,
      address,
      contact_person,
      phone,
      email,
      is_active,
      created_at,
      updated_at
    FROM customer
    ORDER BY id DESC
  `)

  res.json(rows)
}

export async function getCustomerById(req, res) {
  const id = req.params.id

  const { rows } = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      tax_code,
      address,
      contact_person,
      phone,
      email,
      is_active,
      created_at,
      updated_at
    FROM customer
    WHERE id = $1
    `,
    [id]
  )

  const customer = rows[0]

  if (!customer) {
    res.status(404).json({
      error: 'Không tìm thấy khách hàng.'
    })
    return
  }

  res.json(customer)
}

export async function checkCodeExists(req, res) {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  
  if (!code) {
    res.status(400).json({
      error: 'Mã khách hàng không được để trống.'
    })
    return
  }
  
  const { rows } = await pool.query(
    'SELECT id FROM customer WHERE code = $1',
    [code]
  )
  
  res.json({
    exists: rows.length > 0
  })
}

export async function createCustomer(req, res) {
  const {
    code,
    name,
    tax_code,
    address,
    contact_person,
    phone,
    email,
    is_active,
    created_by
  } = req.body

  if (!code || !name) {
    res.status(400).json({
      error: 'Mã khách hàng và tên khách hàng là bắt buộc.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO customer (
        code,
        name,
        tax_code,
        address,
        contact_person,
        phone,
        email,
        is_active,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, code, name
      `,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        is_active !== false,
        created_by || null
      ]
    )

    res.json({
      success: true,
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name
    })
  } catch (err) {
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      
      if (constraint.includes('code') || constraint.includes('customer_code_key')) {
        res.status(400).json({
          error: 'Mã khách hàng này đã tồn tại trong hệ thống.'
        })
      } else {
        res.status(400).json({
          error: 'Dữ liệu bị trùng lặp trong hệ thống.'
        })
      }
      return
    }
    
    console.error('Lỗi khi tạo customer:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo khách hàng.'
    })
  }
}

export async function updateCustomer(req, res) {
  const id = req.params.id
  const {
    code,
    name,
    tax_code,
    address,
    contact_person,
    phone,
    email,
    is_active,
    updated_by
  } = req.body

  if (!code || !name) {
    res.status(400).json({
      error: 'Mã khách hàng và tên khách hàng là bắt buộc.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      `
      UPDATE customer
      SET
        code = $1,
        name = $2,
        tax_code = $3,
        address = $4,
        contact_person = $5,
        phone = $6,
        email = $7,
        is_active = $8,
        updated_by = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING id, code, name
      `,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        is_active !== false,
        updated_by || null,
        id
      ]
    )

    if (rows.length === 0) {
      res.status(404).json({
        error: 'Không tìm thấy khách hàng.'
      })
      return
    }

    res.json({
      success: true,
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name
    })
  } catch (err) {
    if (err.code === '23505') {
      const constraint = err.constraint || err.detail || ''
      
      if (constraint.includes('code') || constraint.includes('customer_code_key')) {
        res.status(400).json({
          error: 'Mã khách hàng này đã tồn tại trong hệ thống.'
        })
      } else {
        res.status(400).json({
          error: 'Dữ liệu bị trùng lặp trong hệ thống.'
        })
      }
      return
    }
    
    console.error('Lỗi khi cập nhật customer:', err)
    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật khách hàng.'
    })
  }
}
