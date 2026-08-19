import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { lookupKey, invalidateLookup, lookupNotModified } from '../services/cacheKeys.js'
import { USERS_TTL, LOOKUP_TTL } from './authShared.js'

// Danh mục cơ cấu tổ chức: phòng ban, chức danh, danh sách quản lý trực tiếp.

// ==================== DEPARTMENT CONTROLLER ====================

export async function getAllDepartments(req, res) {
  if (await lookupNotModified(req, res, 'departments')) return
  const rows = await cacheWrap(lookupKey('departments'), LOOKUP_TTL, async () => {
    const { rows } = await pool.query(`
      SELECT
        id,
        code,
        name
      FROM department
      WHERE is_active = true
      ORDER BY id
    `)
    return rows
  })

  res.json(rows)
}

export async function createDepartment(req, res) {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  const name = String(req.body?.name ?? '').trim()
  if (!code || !name) {
    res.status(400).json({ error: 'Mã và tên phòng ban là bắt buộc.' })
    return
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO department (code, name) VALUES ($1, $2) RETURNING id, code, name`,
      [code, name],
    )
    invalidateLookup('departments')
    res.json({ success: true, ...rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Mã phòng ban này đã tồn tại trong hệ thống.' })
      return
    }
    console.error('Lỗi khi tạo phòng ban:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi tạo phòng ban.' })
  }
}

export async function updateDepartment(req, res) {
  const id = req.params.id
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  const name = String(req.body?.name ?? '').trim()
  if (!code || !name) {
    res.status(400).json({ error: 'Mã và tên phòng ban là bắt buộc.' })
    return
  }
  try {
    const { rows } = await pool.query(
      `UPDATE department SET code = $1, name = $2, updated_at = now() WHERE id = $3 RETURNING id, code, name`,
      [code, name, id],
    )
    if (!rows.length) { res.status(404).json({ error: 'Không tìm thấy phòng ban.' }); return }
    invalidateLookup('departments')
    res.json({ success: true, ...rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Mã phòng ban này đã tồn tại trong hệ thống.' })
      return
    }
    console.error('Lỗi khi cập nhật phòng ban:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật phòng ban.' })
  }
}

// ==================== POSITION CONTROLLER ====================

export async function getAllPositions(req, res) {
  if (await lookupNotModified(req, res, 'positions')) return
  const rows = await cacheWrap(lookupKey('positions'), LOOKUP_TTL, async () => {
    const { rows } = await pool.query(`
      SELECT
        id,
        code,
        name
      FROM position
      ORDER BY id
    `)
    return rows
  })

  res.json(rows)
}

export async function createPosition(req, res) {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  const name = String(req.body?.name ?? '').trim()
  if (!code || !name) {
    res.status(400).json({ error: 'Mã và tên vị trí là bắt buộc.' })
    return
  }
  try {
    // level_no NOT NULL nhưng không có ô nhập riêng → tự gán kế tiếp theo thứ tự hiện có.
    const { rows } = await pool.query(
      `INSERT INTO "position" (code, name, level_no)
       VALUES ($1, $2, COALESCE((SELECT MAX(level_no) FROM "position"), 0) + 1)
       RETURNING id, code, name`,
      [code, name],
    )
    invalidateLookup('positions')
    res.json({ success: true, ...rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Mã vị trí này đã tồn tại trong hệ thống.' })
      return
    }
    console.error('Lỗi khi tạo vị trí:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi tạo vị trí.' })
  }
}

export async function updatePosition(req, res) {
  const id = req.params.id
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  const name = String(req.body?.name ?? '').trim()
  if (!code || !name) {
    res.status(400).json({ error: 'Mã và tên vị trí là bắt buộc.' })
    return
  }
  try {
    const { rows } = await pool.query(
      `UPDATE "position" SET code = $1, name = $2 WHERE id = $3 RETURNING id, code, name`,
      [code, name, id],
    )
    if (!rows.length) { res.status(404).json({ error: 'Không tìm thấy vị trí.' }); return }
    invalidateLookup('positions')
    res.json({ success: true, ...rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Mã vị trí này đã tồn tại trong hệ thống.' })
      return
    }
    console.error('Lỗi khi cập nhật vị trí:', err)
    res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật vị trí.' })
  }
}

// ==================== MANAGER CONTROLLER ====================

export async function getAllManagers(req, res) {
  if (await lookupNotModified(req, res, 'managers')) return
  const rows = await cacheWrap(lookupKey('managers'), USERS_TTL, async () => {
    const { rows } = await pool.query(`
      SELECT
        id,
        full_name,
        is_active
      FROM app_user
      ORDER BY full_name
    `)
    return rows
  })

  res.json(rows)
}

