import { pool } from '../db.js'
import { ALL_PERMISSIONS, expandWithRequires } from './permissionCatalog.js'

const CONTRACT_KEYS = ALL_PERMISSIONS.filter(p => p.scope === 'contract').map(p => p.key)
const CONTRACT_KEY_SET = new Set(CONTRACT_KEYS)

// ─────────────────────────────────────────────────────────────────────────────
// Lớp A — quyền toàn cục hiệu lực của một user.
//   Quyền RIÊNG = HỢP position_permission của mọi position user giữ (app_user_position +
//     cột legacy app_user.position_id) + override 'allow', mở rộng `requires`, trừ override 'deny'.
//   KẾ THỪA TRƯỞNG/PHÓ PHÒNG: nếu user giữ chức TP (Trưởng ban) hoặc PP (Phó ban) và có
//     department_id, thì quyền hiệu lực còn HỢP THÊM quyền RIÊNG của MỌI thành viên cùng phòng
//     ("user được cấp quyền gì thì trưởng/phó phòng của họ cũng có"). Tính lúc-truy-vấn,
//     không lưu trùng.
//   Admin (role==1) fail-open: toàn quyền.
//
// position_permission là bảng (position_id, perm_key) DÙNG CHUNG cho cả quyền global
// LẪN quyền hợp đồng (contract-scope) cấp theo VỊ TRÍ — áp toàn cục cho MỌI hợp đồng.
// loadEffectiveByScope lọc theo scope nên cùng một cơ chế (position + override + kế thừa
// TP/PP) phục vụ được cả hai lớp.
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_KEYS = ALL_PERMISSIONS.filter(p => p.scope === 'global').map(p => p.key)
const GLOBAL_KEY_SET = new Set(GLOBAL_KEYS)
const HEAD_POSITION_CODES = ['TP', 'PP'] // Trưởng ban / Phó ban

export function allGlobalKeys() {
  return [...GLOBAL_KEYS]
}

// Quyền RIÊNG thô của 1 user (chưa lọc scope, chưa kế thừa): tập allow (position +
// department + override 'allow') và tập deny (override 'deny').
async function effectiveOwnRaw(userId) {
  const { rows } = await pool.query(
    `WITH user_pos AS (
       SELECT position_id FROM app_user_position WHERE user_id = $1
       UNION
       SELECT position_id FROM app_user WHERE id = $1 AND position_id IS NOT NULL
     )
     SELECT DISTINCT pp.perm_key AS key
       FROM position_permission pp
       JOIN user_pos up ON up.position_id = pp.position_id`,
    [userId],
  )
  const allow = new Set(rows.map(r => r.key))
  // Tầng PHÒNG BAN: mọi quyền cấp cho phòng của user (department_permission) → hợp vào allow.
  const { rows: deptRows } = await pool.query(
    `SELECT dp.perm_key AS key
       FROM department_permission dp
       JOIN app_user u ON u.department_id = dp.department_id
      WHERE u.id = $1`,
    [userId],
  )
  for (const r of deptRows) allow.add(r.key)
  const { rows: ov } = await pool.query(
    'SELECT perm_key, effect FROM user_permission_override WHERE user_id = $1',
    [userId],
  )
  for (const o of ov) if (o.effect === 'allow') allow.add(o.perm_key)
  const deny = new Set(ov.filter(o => o.effect === 'deny').map(o => o.perm_key))
  return { allow, deny }
}

// Quyền hiệu lực (đã mở rộng requires + kế thừa TP/PP) của 1 user, LỌC theo scopeSet.
// Dùng chung cho Lớp A (global) và quyền HĐ cấp theo vị trí (contract). deny chỉ trừ vào
// quyền RIÊNG, không trừ phần kế thừa từ thành viên phòng (giữ nguyên ngữ nghĩa cũ).
async function loadEffectiveByScope(userId, scopeSet) {
  const { allow, deny } = await effectiveOwnRaw(userId)
  let keys = new Set(expandWithRequires([...allow]).filter(k => scopeSet.has(k)))
  if (deny.size) keys = new Set([...keys].filter(k => !deny.has(k)))

  const deptIds = await headDeptIds(userId)
  if (deptIds.length) {
    const inheritedRaw = await deptMembersEffectiveRaw(deptIds)
    for (const k of expandWithRequires(inheritedRaw).filter(k => scopeSet.has(k))) keys.add(k)
  }
  return [...keys]
}

// Các phòng (department_id) mà user là Trưởng/Phó ban (giữ chức TP/PP, cùng phòng).
async function headDeptIds(userId) {
  const { rows } = await pool.query(
    `SELECT u.department_id AS dept
       FROM app_user u
      WHERE u.id = $1 AND u.department_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM app_user_position up JOIN "position" p ON p.id = up.position_id
                   WHERE up.user_id = $1 AND p.code = ANY($2))
          OR EXISTS (SELECT 1 FROM "position" p WHERE p.id = u.position_id AND p.code = ANY($2))
        )`,
    [userId, HEAD_POSITION_CODES],
  )
  return rows.map(r => r.dept)
}

// Hợp quyền RIÊNG hiệu lực (allow trừ deny của từng người) của MỌI thành viên trong các phòng.
async function deptMembersEffectiveRaw(deptIds) {
  const { rows } = await pool.query(
    `WITH members AS (SELECT id, position_id FROM app_user WHERE department_id = ANY($1::int[])),
     mpos AS (
       SELECT m.id AS user_id, aup.position_id FROM members m JOIN app_user_position aup ON aup.user_id = m.id
       UNION
       SELECT m.id, m.position_id FROM members m WHERE m.position_id IS NOT NULL
     ),
     allow AS (
       SELECT mp.user_id, pp.perm_key FROM mpos mp JOIN position_permission pp ON pp.position_id = mp.position_id
       UNION
       SELECT upo.user_id, upo.perm_key FROM user_permission_override upo
         JOIN members m ON m.id = upo.user_id WHERE upo.effect = 'allow'
     ),
     deny AS (
       SELECT upo.user_id, upo.perm_key FROM user_permission_override upo
         JOIN members m ON m.id = upo.user_id WHERE upo.effect = 'deny'
     )
     SELECT DISTINCT a.perm_key FROM allow a
       LEFT JOIN deny d ON d.user_id = a.user_id AND d.perm_key = a.perm_key
      WHERE d.perm_key IS NULL`,
    [deptIds],
  )
  return rows.map(r => r.perm_key)
}

export async function loadGlobalPermissions(userId, role) {
  if (Number(role) === 1) return [...GLOBAL_KEYS] // admin: toàn quyền
  return loadEffectiveByScope(userId, GLOBAL_KEY_SET)
}

// Quyền HĐ (contract-scope) mà user được cấp THEO VỊ TRÍ (toàn cục) — áp cho MỌI hợp đồng,
// không phụ thuộc là thành viên HĐ. Gồm cả kế thừa TP/PP. Dùng cho cả FE show/hide lẫn
// write guard (contractAccess.js).
export async function loadPositionContractPerms(userId, role) {
  if (Number(role) === 1) return [...CONTRACT_KEYS] // admin: toàn quyền HĐ
  return loadEffectiveByScope(userId, CONTRACT_KEY_SET)
}

// ─────────────────────────────────────────────────────────────────────────────
// Lớp B — quyền theo hợp đồng hiệu lực của user trong MỘT hợp đồng bán.
//   = HỢP (contract_role_permission của mọi member_role user giữ trong HĐ đó)
//     ∪ (quyền HĐ cấp THEO VỊ TRÍ toàn cục — loadPositionContractPerms).
//   Admin (role==1) fail-open: toàn bộ quyền HĐ. Dùng cho FE ẩn/hiện tab + section
//   (KHÔNG chặn GET; ghi vẫn do contractAccess.js/creator-ownership quyết).
// ─────────────────────────────────────────────────────────────────────────────
export async function loadContractPermissions(userId, role, contractId) {
  if (Number(role) === 1) return [...CONTRACT_KEYS] // admin: toàn quyền HĐ

  const { rows } = await pool.query(
    `SELECT DISTINCT crp.perm_key AS key
       FROM contract_out_member m
       JOIN contract_role_permission crp ON crp.member_role = m.member_role
      WHERE m.user_id = $1 AND m.contract_out_id = $2`,
    [userId, contractId],
  )
  const keys = new Set(rows.map(r => r.key))
  for (const k of await loadPositionContractPerms(userId, role)) keys.add(k)
  return [...keys]
}

// Middleware: chặn nếu user không có quyền global `key`. Admin luôn qua.
export function requirePermission(key) {
  return async function permGuard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next()
      const keys = await loadGlobalPermissions(req.user.id, req.user.role)
      if (keys.includes(key)) return next()
      res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' })
    } catch (err) {
      next(err)
    }
  }
}
