import { Fragment, useMemo, useState } from 'react'
import { groupPerms, saveContractRole } from './permissionApi'
import { buildGraph } from './permGraph'

// Ma trận Lớp B: hàng = quyền tab/section HĐ, cột = vai trò trong HĐ (member_role).
// `rowPerms` lọc hàng (panel hiện theo trang chi tiết HĐ); `grants` là TOÀN BỘ theo role.
export default function ContractRolePermissionMatrix({ rowPerms, allPerms, roles, grants, onGrantsChange }) {
  const graph = useMemo(() => buildGraph(allPerms), [allPerms])
  const groups = useMemo(() => groupPerms(rowPerms), [rowPerms])
  const [savingRole, setSavingRole] = useState(null)

  async function toggle(role, key, checked) {
    const cur = new Set(grants[role] || [])
    if (checked) {
      const expanded = graph.expand([key])
      const added = [...expanded].filter(k => !cur.has(k))
      for (const k of expanded) cur.add(k)
      const extra = added.filter(k => k !== key)
      if (extra.length) {
        const labels = extra.map(k => allPerms.find(p => p.key === k)?.label || k).join(', ')
        alert(`Đã tự bật kèm: ${labels} (vì «${allPerms.find(p => p.key === key)?.label || key}» cần).`)
      }
    } else {
      const deps = [...graph.dependentsClosure(key)].filter(k => cur.has(k))
      if (deps.length) {
        const labels = deps.map(k => allPerms.find(p => p.key === k)?.label || k).join(', ')
        if (!confirm(`«${allPerms.find(p => p.key === key)?.label || key}» đang được cần bởi: ${labels}.\nBỏ sẽ gỡ luôn các quyền đó. Tiếp tục?`)) return
      }
      cur.delete(key)
      for (const k of deps) cur.delete(k)
    }
    const next = [...cur]
    setSavingRole(role)
    try {
      const r = await saveContractRole(role, next)
      onGrantsChange(role, r.perm_keys)
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingRole(null)
    }
  }

  return (
    <div className="perm-matrix-scroll">
      <table className="perm-matrix">
        <thead>
          <tr>
            <th className="perm-matrix-rowhead">Quyền \ Vai trò HĐ</th>
            {roles.map(r => (
              <th key={r.role} className={`perm-col${savingRole === r.role ? ' saving' : ''}`} title={r.label}>{r.role}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([group, perms]) => (
            <Fragment key={group}>
              <tr className="perm-group-row"><td colSpan={roles.length + 1}>{group}</td></tr>
              {perms.map(perm => (
                <tr key={perm.key}>
                  <td className="perm-matrix-rowhead">
                    {perm.label}
                    {perm.kind === 'section' && <span className="perm-section-tag" title="Xem một phần">phần</span>}
                  </td>
                  {roles.map(r => {
                    const checked = (grants[r.role] || []).includes(perm.key)
                    return (
                      <td key={r.role} className="perm-cell">
                        <input type="checkbox" checked={checked} onChange={e => toggle(r.role, perm.key, e.target.checked)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
