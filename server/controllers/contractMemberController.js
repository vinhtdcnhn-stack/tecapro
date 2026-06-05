const TEAM_ROLES = [
  { key: 'sale_team',       role: 'Sale',       rank: 2 },
  { key: 'presale_team',    role: 'Presale',    rank: 3 },
  { key: 'technical_team',  role: 'Technical',  rank: 4 },
  { key: 'accounting_team', role: 'Accounting', rank: 5 },
  { key: 'followers',       role: 'Follower',   rank: 6 },
]

/**
 * Insert all team members for a contract inside an existing transaction client.
 * Uses a single bulk INSERT for all members combined.
 */
export async function insertContractMembers(client, contractId, { pm_primary_id, pm_team, sale_team, presale_team, technical_team, accounting_team, followers }) {
  const teams = { sale_team, presale_team, technical_team, accounting_team, followers }
  const tuples = [] // [contractId, userId, role, isPrimary, rank]

  // PM team — first entry is primary
  const pmList = Array.isArray(pm_team) && pm_team.length > 0 ? pm_team : (pm_primary_id ? [pm_primary_id] : [])
  pmList.forEach((userId, i) => tuples.push([contractId, userId, 'PM', i === 0, 1]))

  // All other teams
  for (const { key, role, rank } of TEAM_ROLES) {
    const list = Array.isArray(teams[key]) ? teams[key] : []
    list.forEach(userId => tuples.push([contractId, userId, role, false, rank]))
  }

  if (tuples.length === 0) return

  const placeholders = tuples.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},NOW())`).join(',')
  await client.query(
    `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank, created_at) VALUES ${placeholders}`,
    tuples.flat()
  )
}
