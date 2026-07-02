import { useMemo, useState } from 'react'
import { groupPerms, saveDepartmentPerm } from './permissionApi'
import { buildGraph } from './permGraph'

// Ma trận Lớp A (tầng PHÒNG BAN): hàng = quyền (theo nhóm), cột = phòng ban. Ô tick = grant
// cho CẢ phòng — mọi user thuộc phòng đó có quyền (song song với cấp theo vị trí).
// `rowPerms` quyết định HÀNG hiển thị; `grants` là TOÀN BỘ grant mỗi phòng (để khi lưu không
// xoá nhầm quyền ngoài tầm nhìn của bảng đang lọc).
export default function DepartmentPermissionMatrix({ rowPerms, allPerms, departments, grants, onGrantsChange }) {
  const graph = useMemo(() => buildGraph(allPerms), [allPerms])
  const groups = useMemo(() => groupPerms(rowPerms), [rowPerms])
  const [savingDept, setSavingDept] = useState(null)

  async function toggle(deptId, key, checked) {
    const cur = new Set(grants[deptId] || [])
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
    setSavingDept(deptId)
    try {
      const r = await saveDepartmentPerm(deptId, next)
      onGrantsChange(deptId, r.perm_keys)
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingDept(null)
    }
  }

  return (
    <div className="perm-matrix-scroll">
      <table className="perm-matrix">
        <thead>
          <tr>
            <th className="perm-matrix-rowhead">Quyền \ Phòng ban</th>
            {departments.map(d => (
              <th key={d.id} className={`perm-col perm-col-dept${savingDept === d.id ? ' saving' : ''}`} title={d.name}>
                {d.name.replace(/^Ban\s+/i, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([group, perms]) => (
            <PermGroupRows key={group} group={group} perms={perms} departments={departments} grants={grants} onToggle={toggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PermGroupRows({ group, perms, departments, grants, onToggle }) {
  return (
    <>
      <tr className="perm-group-row"><td colSpan={departments.length + 1}>{group}</td></tr>
      {perms.map(perm => (
        <tr key={perm.key}>
          <td className="perm-matrix-rowhead">
            {perm.label}
            {perm.kind === 'section' && <span className="perm-section-tag" title="Xem một phần">phần</span>}
            {perm.adminOnly && <span className="perm-admin-tag" title="Mặc định chỉ admin">admin</span>}
          </td>
          {departments.map(dept => {
            const checked = (grants[dept.id] || []).includes(perm.key)
            return (
              <td key={dept.id} className="perm-cell">
                <input type="checkbox" checked={checked} onChange={e => onToggle(dept.id, perm.key, e.target.checked)} />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
