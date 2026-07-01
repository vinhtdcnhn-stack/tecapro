import { pool } from '../db.js'
import {
  ALL_PERMISSIONS, MEMBER_ROLES, expandWithRequires, pageForPath, permByKey,
} from '../auth/permissionCatalog.js'
import { invalidateLookup } from '../services/cacheKeys.js'

// ─────────────────────────────────────────────────────────────────────────────
// API module Phân quyền. Mọi route gắn requirePermission('system.permissions.manage').
// Server LUÔN tự mở rộng bao đóng `requires` trước khi ghi (không tin UI).
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_KEYS = new Set(ALL_PERMISSIONS.filter(p => p.scope === 'global').map(p => p.key))
const CONTRACT_KEYS = new Set(ALL_PERMISSIONS.filter(p => p.scope === 'contract').map(p => p.key))
const ROLE_SET = new Set(MEMBER_ROLES.map(r => r.role))

// Catalog đầy đủ cho FE (ma trận + panel). Hàm test() của PAGES không serialize được nên
// việc khớp trang chạy ở /for-page.
export function getCatalog(_req, res) {
  res.json({
    permissions: ALL_PERMISSIONS.map(p => ({
      key: p.key, scope: p.scope, kind: p.kind, label: p.label,
      group: p.group, requires: p.requires || [], adminOnly: p.adminOnly === true,
      sort_order: p.sort_order,
    })),
    memberRoles: MEMBER_ROLES,
  })
}

// Trang hiện tại → các quyền liên quan (cho panel Ctrl+Shift+Q).
export function getForPage(req, res) {
  const path = String(req.query.path || '')
  const pg = pageForPath(path)
  if (!pg) { res.json({ page: null }); return }
  const keySet = new Set(pg.permKeys)
  const slim = (p) => ({ key: p.key, scope: p.scope, kind: p.kind, label: p.label, group: p.group, requires: p.requires || [], adminOnly: p.adminOnly === true })
  // Lớp A liên quan trang (relatedGlobalKeys): với trang scope='contract', panel hiện thêm
  // ma trận theo VỊ TRÍ cho các quyền toàn cục này (vd quyền vào module HĐ bán).
  const relatedSet = new Set(pg.relatedGlobalKeys || [])
  res.json({
    page: { id: pg.id, label: pg.label, scope: pg.scope, relatedGlobalKeys: pg.relatedGlobalKeys || [] },
    perms: ALL_PERMISSIONS.filter(p => keySet.has(p.key)).map(slim),
    globalPerms: ALL_PERMISSIONS.filter(p => relatedSet.has(p.key)).map(slim),
  })
}

// ── Lớp A: ma trận position × perm ──────────────────────────────────────────
export async function getGlobalMatrix(_req, res) {
  const { rows: positions } = await pool.query(
    'SELECT id, code, name FROM "position" WHERE is_active = true ORDER BY level_no, id',
  )
  const { rows: grants } = await pool.query('SELECT position_id, perm_key FROM position_permission')
  const map = {}
  for (const g of grants) (map[g.position_id] ||= []).push(g.perm_key)
  res.json({ positions, grants: map })
}

export async function putGlobalMatrix(req, res) {
  const positionId = Number(req.body?.position_id)
  if (!Number.isInteger(positionId)) { res.status(400).json({ error: 'position_id không hợp lệ.' }); return }
  const raw = Array.isArray(req.body?.perm_keys) ? req.body.perm_keys : []
  // Mở rộng bao đóng tiền đề. position_permission cấp được CẢ quyền global LẪN quyền HĐ
  // (contract-scope) theo vị trí — áp toàn cục cho mọi HĐ. Chỉ loại key không hợp lệ.
  const keys = expandWithRequires(raw).filter(k => GLOBAL_KEYS.has(k) || CONTRACT_KEYS.has(k))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pos = await client.query('SELECT 1 FROM "position" WHERE id = $1', [positionId])
    if (!pos.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Vị trí không tồn tại.' }); return }
    await client.query('DELETE FROM position_permission WHERE position_id = $1', [positionId])
    for (const k of keys) {
      await client.query('INSERT INTO position_permission (position_id, perm_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [positionId, k])
    }
    await client.query('COMMIT')
    res.json({ position_id: positionId, perm_keys: keys })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ── Thành viên của một vị trí (Lớp A) ───────────────────────────────────────
// "Ai đang giữ vị trí này" = app_user_position ∪ cột legacy app_user.position_id
// (đúng theo cách quyền hiệu lực được tính ở permissions.js → effectiveOwnRaw).
async function positionMemberIds(positionId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM app_user_position WHERE position_id = $1
     UNION
     SELECT id FROM app_user WHERE position_id = $1`,
    [positionId],
  )
  return rows.map(r => r.user_id)
}

export async function getPositionMembers(req, res) {
  const positionId = Number(req.query.position_id)
  if (!Number.isInteger(positionId)) { res.status(400).json({ error: 'position_id không hợp lệ.' }); return }
  const pos = await pool.query('SELECT id, code, name FROM "position" WHERE id = $1', [positionId])
  if (!pos.rows.length) { res.status(404).json({ error: 'Vị trí không tồn tại.' }); return }

  const memberIds = await positionMemberIds(positionId)
  const { rows: members } = await pool.query(
    `SELECT u.id, u.full_name, u.email, d.name AS department_name
       FROM app_user u
       LEFT JOIN department d ON d.id = u.department_id
      WHERE u.id = ANY($1::int[])
      ORDER BY u.full_name`,
    [memberIds.length ? memberIds : [0]],
  )
  // Ứng viên để thêm = mọi user CHƯA giữ vị trí này.
  const { rows: candidates } = await pool.query(
    `SELECT u.id, u.full_name, d.name AS department_name
       FROM app_user u
       LEFT JOIN department d ON d.id = u.department_id
      WHERE u.id <> ALL($1::int[])
      ORDER BY u.full_name`,
    [memberIds.length ? memberIds : [0]],
  )
  res.json({ position: pos.rows[0], members, candidates })
}

export async function addPositionMember(req, res) {
  const positionId = Number(req.body?.position_id)
  const userId = Number(req.body?.user_id)
  if (!Number.isInteger(positionId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: 'Tham số không hợp lệ.' }); return
  }
  const pos = await pool.query('SELECT 1 FROM "position" WHERE id = $1', [positionId])
  if (!pos.rows.length) { res.status(404).json({ error: 'Vị trí không tồn tại.' }); return }
  const u = await pool.query('SELECT 1 FROM app_user WHERE id = $1', [userId])
  if (!u.rows.length) { res.status(404).json({ error: 'Người dùng không tồn tại.' }); return }
  await pool.query(
    'INSERT INTO app_user_position (user_id, position_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [userId, positionId],
  )
  invalidateLookup('users', 'managers', 'dw-members', 'approval-users')
  res.json({ success: true })
}

export async function removePositionMember(req, res) {
  const positionId = Number(req.body?.position_id)
  const userId = Number(req.body?.user_id)
  if (!Number.isInteger(positionId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: 'Tham số không hợp lệ.' }); return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM app_user_position WHERE user_id = $1 AND position_id = $2', [userId, positionId])
    // Gỡ luôn cột legacy nếu đang trỏ tới vị trí này, không thì quyền vẫn còn (UNION).
    await client.query('UPDATE app_user SET position_id = NULL WHERE id = $1 AND position_id = $2', [userId, positionId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
  invalidateLookup('users', 'managers', 'dw-members', 'approval-users')
  res.json({ success: true })
}

// ── Lớp B: ma trận member_role × perm ───────────────────────────────────────
export async function getContractMatrix(_req, res) {
  const { rows } = await pool.query('SELECT member_role, perm_key FROM contract_role_permission')
  const map = {}
  for (const g of rows) (map[g.member_role] ||= []).push(g.perm_key)
  res.json({ memberRoles: MEMBER_ROLES, grants: map })
}

export async function putContractMatrix(req, res) {
  const role = String(req.body?.member_role || '')
  if (!ROLE_SET.has(role)) { res.status(400).json({ error: 'member_role không hợp lệ.' }); return }
  const raw = Array.isArray(req.body?.perm_keys) ? req.body.perm_keys : []
  const keys = expandWithRequires(raw).filter(k => CONTRACT_KEYS.has(k))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM contract_role_permission WHERE member_role = $1', [role])
    for (const k of keys) {
      await client.query('INSERT INTO contract_role_permission (member_role, perm_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [role, k])
    }
    await client.query('COMMIT')
    res.json({ member_role: role, perm_keys: keys })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// Override theo user nhận CẢ quyền global LẪN quyền HĐ (contract-scope); override quyền HĐ
// áp toàn cục cho mọi hợp đồng của user (loadPositionContractPerms đã đọc override này).
const OVERRIDE_KEYS = new Set([...GLOBAL_KEYS, ...CONTRACT_KEYS])

// ── Override theo user (global + contract-scope, áp toàn cục) ────────────────
export async function getUserOverrides(req, res) {
  const userId = Number(req.query.user_id)
  if (!Number.isInteger(userId)) { res.status(400).json({ error: 'user_id không hợp lệ.' }); return }
  const { rows } = await pool.query(
    'SELECT perm_key, effect FROM user_permission_override WHERE user_id = $1', [userId],
  )
  res.json({
    user_id: userId,
    allow: rows.filter(r => r.effect === 'allow').map(r => r.perm_key),
    deny: rows.filter(r => r.effect === 'deny').map(r => r.perm_key),
  })
}

export async function putUserOverrides(req, res) {
  const userId = Number(req.body?.user_id)
  if (!Number.isInteger(userId)) { res.status(400).json({ error: 'user_id không hợp lệ.' }); return }
  // Nhận key global + contract-scope hợp lệ; allow mở rộng bao đóng, deny giữ nguyên (không kéo theo).
  const allow = expandWithRequires(Array.isArray(req.body?.allow) ? req.body.allow : []).filter(k => OVERRIDE_KEYS.has(k))
  const deny = (Array.isArray(req.body?.deny) ? req.body.deny : []).filter(k => OVERRIDE_KEYS.has(k) && permByKey(k))
  const denySet = new Set(deny)
  const allowFinal = allow.filter(k => !denySet.has(k)) // deny thắng

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const u = await client.query('SELECT 1 FROM app_user WHERE id = $1', [userId])
    if (!u.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'User không tồn tại.' }); return }
    await client.query('DELETE FROM user_permission_override WHERE user_id = $1', [userId])
    for (const k of allowFinal) {
      await client.query('INSERT INTO user_permission_override (user_id, perm_key, effect) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, k, 'allow'])
    }
    for (const k of deny) {
      await client.query('INSERT INTO user_permission_override (user_id, perm_key, effect) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, k, 'deny'])
    }
    await client.query('COMMIT')
    res.json({ user_id: userId, allow: allowFinal, deny })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
