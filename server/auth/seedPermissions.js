import 'dotenv/config'
import { pool } from '../db.js'
import {
  ALL_PERMISSIONS, MEMBER_ROLES, expandWithRequires,
} from './permissionCatalog.js'

// ─────────────────────────────────────────────────────────────────────────────
// Đồng bộ danh mục `permission` từ catalog (nguồn-sự-thật-duy-nhất) + seed bootstrap
// một lần. Idempotent. Chạy lúc server khởi động (syncPermissionCatalog) và chạy tay:
//     node server/auth/seedPermissions.js
// ─────────────────────────────────────────────────────────────────────────────

// Upsert mọi quyền trong catalog; xoá quyền "mồ côi" (không còn trong catalog).
export async function syncPermissionCatalog(client = pool) {
  const keys = ALL_PERMISSIONS.map(p => p.key)
  for (const p of ALL_PERMISSIONS) {
    await client.query(
      `INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (key) DO UPDATE SET
         scope = EXCLUDED.scope, kind = EXCLUDED.kind, label = EXCLUDED.label,
         group_label = EXCLUDED.group_label, admin_only = EXCLUDED.admin_only,
         sort_order = EXCLUDED.sort_order`,
      [p.key, p.scope, p.kind, p.label, p.group, p.adminOnly === true, p.sort_order],
    )
  }
  await client.query(`DELETE FROM permission WHERE key <> ALL($1::varchar[])`, [keys])
}

// Map user→position (gộp app_user_position nhiều-nhiều + cột legacy app_user.position_id).
const USER_POS_CTE = `
  WITH user_pos AS (
    SELECT user_id, position_id FROM app_user_position
    UNION
    SELECT id AS user_id, position_id FROM app_user WHERE position_id IS NOT NULL
  )`

// Seed bootstrap CHỈ khi chưa có grant nào (lần đầu) — để go-live ≈ hành vi cũ.
export async function seedBootstrap(client = pool) {
  const { rows: existing } = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM position_permission)      AS pp,
       (SELECT COUNT(*) FROM contract_role_permission) AS crp`,
  )
  if (Number(existing[0].pp) > 0 || Number(existing[0].crp) > 0) {
    return { skipped: true }
  }

  // ── Lớp A: position_permission ──────────────────────────────────────────
  // Quyền mở cho MỌI position: vào Đề xuất / Tra cứu bảo hành / Hệ thống + 2 bảng điều
  // khiển luôn-có (Việc của tôi / Chưa đọc).
  const ALL_POS_PERMS = [
    'module.approvals.view', 'module.warranty_lookup.view', 'module.system.view',
    'dashboard.assignee.view', 'dashboard.unread.view',
  ]
  for (const perm of ALL_POS_PERMS) {
    await client.query(
      `INSERT INTO position_permission (position_id, perm_key)
         SELECT id, $1 FROM "position" WHERE is_active = true
       ON CONFLICT DO NOTHING`,
      [perm],
    )
  }
  // module.contracts.view → position có ≥1 user đang là thành viên hợp đồng.
  await client.query(
    `${USER_POS_CTE}
     INSERT INTO position_permission (position_id, perm_key)
       SELECT DISTINCT up.position_id, 'module.contracts.view'
         FROM user_pos up
        WHERE up.position_id IS NOT NULL
          AND up.user_id IN (SELECT DISTINCT user_id FROM contract_out_member)
     ON CONFLICT DO NOTHING`,
  )
  // module.deptwork.view  → position có ≥1 user phòng KT Cơ điện (dept 7).
  // module.tender.view    → position có ≥1 user Ban Kế hoạch Đấu thầu (dept 9).
  // dashboard.accounting  → position có ≥1 user Ban Kế Toán (dept 2).
  // dashboard.tender      → position có ≥1 user Ban Kế hoạch Đấu thầu (dept 9).
  for (const [perm, dept] of [
    ['module.deptwork.view', 7], ['module.tender.view', 9],
    ['dashboard.accounting.view', 2], ['dashboard.tender.view', 9],
  ]) {
    await client.query(
      `${USER_POS_CTE}
       INSERT INTO position_permission (position_id, perm_key)
         SELECT DISTINCT up.position_id, $1
           FROM user_pos up JOIN app_user u ON u.id = up.user_id
          WHERE up.position_id IS NOT NULL AND u.department_id = $2
       ON CONFLICT DO NOTHING`,
      [perm, dept],
    )
  }
  // Bảng điều khiển neo theo MÃ vị trí (khớp gating cũ trong useHomeDashboards):
  //   pm→PM_TEAM, dept→TB/PB, director→GD/PGD/TQ_TEAM, accounting→KT_DASH.
  for (const [perm, codes] of [
    ['dashboard.pm.view',         ['PM_TEAM']],
    ['dashboard.dept.view',       ['TB', 'PB']],
    ['dashboard.director.view',   ['GD', 'PGD', 'TQ_TEAM']],
    ['dashboard.accounting.view', ['GD', 'PGD', 'KT_DASH']],
    // Khóa/mở khóa bảng giá — quyền giám sát của Trưởng/Phó ban (không cấp cho PM).
    ['co.boq.lock',               ['TB', 'PB']],
  ]) {
    await client.query(
      `INSERT INTO position_permission (position_id, perm_key)
         SELECT id, $1 FROM "position" WHERE is_active = true AND code = ANY($2)
       ON CONFLICT DO NOTHING`,
      [perm, codes],
    )
  }
  // Lưu ý: KHÔNG seed các quyền *.manage / admin_only → mặc định chỉ admin (role==1, fail-open).

  // ── Lớp B: contract_role_permission ─────────────────────────────────────
  const tabViews   = ALL_PERMISSIONS.filter(p => p.scope === 'contract' && p.kind === 'tab' && p.key.endsWith('.view')).map(p => p.key)
  const sections   = ALL_PERMISSIONS.filter(p => p.scope === 'contract' && p.kind === 'section').map(p => p.key)
  // Mọi member_role: ĐỌC mọi tab + thấy mọi section (đọc mở cho thành viên như hành vi cũ).
  const baseRead = [...tabViews, ...sections]
  // Quyền GHI: bám SÁT hành vi guard hiện tại để parity khi cắt chuyển.
  //  • HĐ bán (co.*) hiện PM-only (pmVia) → CHỈ PM có co.*.manage.
  //  • HĐ nhập (ci.*) hiện creator-ownership (KHÔNG qua ma trận); để PM có ci.*.manage cho nhất
  //    quán hiển thị, nhưng backend HĐ nhập vẫn theo người tạo (ci guard không đổi).
  // Technical/serial phía HĐ nhập do ownerOrTechVia lo (creator/Technical của HĐ bán cha), không seed ở đây.
  const manageByRole = {
    PM: ALL_PERMISSIONS.filter(p => p.scope === 'contract' && p.kind === 'tab' && p.key.endsWith('.manage')).map(p => p.key),
  }
  for (const { role } of MEMBER_ROLES) {
    const keys = expandWithRequires([...baseRead, ...(manageByRole[role] || [])])
    for (const perm of keys) {
      await client.query(
        `INSERT INTO contract_role_permission (member_role, perm_key) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [role, perm],
      )
    }
  }
  return { skipped: false }
}

// Gọi 1 phát lúc khởi động: sync catalog (luôn) + bootstrap (chỉ lần đầu).
export async function initPermissions() {
  await syncPermissionCatalog()
  return seedBootstrap()
}

// CLI: node server/auth/seedPermissions.js
const isMain = process.argv[1] && process.argv[1].endsWith('seedPermissions.js')
if (isMain) {
  try {
    await syncPermissionCatalog()
    const r = await seedBootstrap()
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM permission)               AS perms,
         (SELECT COUNT(*) FROM position_permission)      AS pos,
         (SELECT COUNT(*) FROM contract_role_permission) AS crp`,
    )
    console.log('[seedPermissions] catalog synced.',
      r.skipped ? 'Bootstrap đã có từ trước (bỏ qua).' : 'Bootstrap seed lần đầu.')
    console.log(`  permission=${rows[0].perms}  position_permission=${rows[0].pos}  contract_role_permission=${rows[0].crp}`)
  } catch (e) {
    console.error('[seedPermissions] LỖI:', e)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
