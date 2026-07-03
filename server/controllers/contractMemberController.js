const TEAM_ROLES = [
  { key: 'sale_team',          role: 'Sale',         rank: 2 },
  { key: 'presale_team',       role: 'Presale',      rank: 3 },
  { key: 'technical_team',     role: 'Technical',    rank: 4 },
  { key: 'import_export_team', role: 'ImportExport', rank: 5 },
  { key: 'accounting_team',    role: 'Accounting',   rank: 6 },
  { key: 'followers',          role: 'Follower',     rank: 7 },
]

/**
 * Dựng danh sách thành viên MONG MUỐN từ payload (chưa ghi DB).
 * Trả về [{ user_id, member_role, is_primary, role_rank }] đã khử trùng lặp theo
 * khóa (user_id, member_role) — khớp ràng buộc uq_contract_member.
 */
export function buildMemberRows({ pm_primary_id, pm_team, sale_team, presale_team, technical_team, import_export_team, accounting_team, followers }) {
  const teams = { sale_team, presale_team, technical_team, import_export_team, accounting_team, followers }
  const byKey = new Map() // `${user_id}::${role}` -> row (giữ lần xuất hiện đầu)

  const add = (userId, member_role, is_primary, role_rank) => {
    const user_id = Number(userId)
    if (!user_id) return
    const key = `${user_id}::${member_role}`
    if (!byKey.has(key)) byKey.set(key, { user_id, member_role, is_primary, role_rank })
  }

  // PM team — first entry is primary
  const pmList = Array.isArray(pm_team) && pm_team.length > 0 ? pm_team : (pm_primary_id ? [pm_primary_id] : [])
  pmList.forEach((userId, i) => add(userId, 'PM', i === 0, 1))

  // All other teams
  for (const { key, role, rank } of TEAM_ROLES) {
    const list = Array.isArray(teams[key]) ? teams[key] : []
    list.forEach(userId => add(userId, role, false, rank))
  }

  return Array.from(byKey.values())
}

const memberKey = (r) => `${Number(r.user_id)}::${r.member_role}`

/**
 * Bulk-insert các hàng thành viên đã dựng sẵn. Trả về chính các hàng đó
 * (để controller gửi thông báo Telegram).
 */
async function insertMemberRows(client, contractId, rows) {
  if (rows.length === 0) return []
  const placeholders = rows.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},NOW())`).join(',')
  const values = rows.flatMap(r => [contractId, r.user_id, r.member_role, r.is_primary, r.role_rank])
  await client.query(
    `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at) VALUES ${placeholders}`,
    values,
  )
  return rows.map(({ user_id, member_role, is_primary }) => ({ user_id, member_role, is_primary }))
}

/**
 * Insert all team members for a contract inside an existing transaction client.
 * Dùng cho lúc TẠO MỚI hợp đồng (bảng còn trống).
 */
export async function insertContractMembers(client, contractId, payload) {
  return insertMemberRows(client, contractId, buildMemberRows(payload))
}

/**
 * Đồng bộ thành viên bằng DIFF thay vì xoá-hết-rồi-chèn-lại: chỉ DELETE người bị
 * bỏ, INSERT người mới, và UPDATE khi is_primary/role_rank đổi (ví dụ đổi PM chính).
 * Nhờ vậy "Nhật ký thay đổi" chỉ ghi đúng phần thực sự thay đổi thay vì cả chục
 * dòng xoá/tạo mỗi lần sửa. Trả về danh sách thành viên MỚI được thêm.
 */
export async function syncContractMembers(client, contractId, payload) {
  const desired = buildMemberRows(payload)

  const existingRes = await client.query(
    'SELECT id, user_id, member_role, is_primary, role_rank FROM contract_out_member WHERE contract_out_id = $1',
    [contractId],
  )

  const existingByKey = new Map()
  for (const r of existingRes.rows) existingByKey.set(memberKey(r), r)
  const desiredByKey = new Map()
  for (const r of desired) desiredByKey.set(memberKey(r), r)

  // DELETE: còn trong DB nhưng không còn trong danh sách mới.
  const toDeleteIds = []
  for (const [key, r] of existingByKey) {
    if (!desiredByKey.has(key)) toDeleteIds.push(r.id)
  }
  if (toDeleteIds.length > 0) {
    await client.query('DELETE FROM contract_out_member WHERE id = ANY($1::bigint[])', [toDeleteIds])
  }

  // INSERT người mới; UPDATE khi cùng người-vai trò nhưng đổi cờ chính/thứ hạng.
  const toInsert = []
  for (const [key, r] of desiredByKey) {
    const cur = existingByKey.get(key)
    if (!cur) {
      toInsert.push(r)
    } else if (Boolean(cur.is_primary) !== Boolean(r.is_primary) || Number(cur.role_rank) !== Number(r.role_rank)) {
      await client.query(
        'UPDATE contract_out_member SET is_primary = $1, role_rank = $2 WHERE id = $3',
        [r.is_primary, r.role_rank, cur.id],
      )
    }
  }

  return insertMemberRows(client, contractId, toInsert)
}

// Nhãn vai trò tiếng Việt để chèn vào thông báo.
export const MEMBER_ROLE_VN = {
  PM: 'PM (Quản lý dự án)',
  Sale: 'Kinh doanh',
  Presale: 'Presale',
  Technical: 'Kỹ thuật',
  ImportExport: 'Xuất nhập khẩu',
  Accounting: 'Kế toán',
  Follower: 'Theo dõi',
}
