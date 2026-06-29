import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { lookupKey, invalidateLookup, lookupNotModified } from '../services/cacheKeys.js'

const SUPPLIERS_TTL = 12 * 60 * 60 // 12h — danh mục ít đổi

const SELECT_FIELDS = `
  SELECT id, code, name, tax_code, address, contact_person, phone, email, note, is_active, created_at, updated_at
  FROM supplier
`

export async function getAllSuppliers(req, res) {
  try {
    if (await lookupNotModified(req, res, 'suppliers')) return
    const rows = await cacheWrap(lookupKey('suppliers'), SUPPLIERS_TTL, async () => {
      const { rows } = await pool.query(`${SELECT_FIELDS} WHERE is_active = true OR is_active = false ORDER BY name ASC`)
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getAllSuppliers:', err)
    res.status(500).json({ error: 'Không thể tải danh sách nhà cung cấp' })
  }
}

export async function getSupplierById(req, res) {
  try {
    const { rows } = await pool.query(`${SELECT_FIELDS} WHERE id = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' })
  }
}

export async function checkSupplierCodeExists(req, res) {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'Mã nhà cung cấp không được để trống' })
  const { rows } = await pool.query('SELECT id FROM supplier WHERE code = $1', [code])
  res.json({ exists: rows.length > 0 })
}

export async function createSupplier(req, res) {
  const { code, name, tax_code, address, contact_person, phone, email, note, is_active, created_by } = req.body

  if (!code || !name) {
    return res.status(400).json({ error: 'Mã và tên nhà cung cấp là bắt buộc' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO supplier (code, name, tax_code, address, contact_person, phone, email, note, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, code, name`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        note?.trim() || null,
        is_active !== false,
        created_by || null,
      ]
    )
    invalidateLookup('suppliers')
    res.json({ success: true, id: rows[0].id, code: rows[0].code, name: rows[0].name })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Mã nhà cung cấp này đã tồn tại trong hệ thống' })
    }
    console.error('createSupplier:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi tạo nhà cung cấp' })
  }
}

export async function updateSupplier(req, res) {
  const id = req.params.id
  const { code, name, tax_code, address, contact_person, phone, email, note, is_active, updated_by } = req.body

  if (!code || !name) {
    return res.status(400).json({ error: 'Mã và tên nhà cung cấp là bắt buộc' })
  }

  try {
    const { rows } = await pool.query(
      `UPDATE supplier SET
        code = $1, name = $2, tax_code = $3, address = $4,
        contact_person = $5, phone = $6, email = $7, note = $8,
        is_active = $9, updated_by = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING id, code, name`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        tax_code?.trim() || null,
        address?.trim() || null,
        contact_person?.trim() || null,
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        note?.trim() || null,
        is_active !== false,
        updated_by || null,
        id,
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' })
    invalidateLookup('suppliers')
    res.json({ success: true, id: rows[0].id, code: rows[0].code, name: rows[0].name })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Mã nhà cung cấp này đã tồn tại trong hệ thống' })
    }
    console.error('updateSupplier:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật nhà cung cấp' })
  }
}
