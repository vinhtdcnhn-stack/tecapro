import { useMemo, useState } from 'react'
import { groupPerms, saveGlobalPosition } from './permissionApi'
import { buildGraph } from './permGraph'
import PositionMembersModal from './PositionMembersModal'

// Ma trận Lớp A: hàng = quyền (theo nhóm), cột = vị trí (position). Ô tick = grant.
// `rowPerms` quyết định HÀNG hiển thị (panel lọc theo trang; trang tổng hiện hết).
// `grants` là TOÀN BỘ grant mỗi position (để khi lưu không xoá nhầm quyền ngoài tầm nhìn).
export default function GlobalPermissionMatrix({ rowPerms, allPerms, positions, grants, onGrantsChange }) {
  const graph = useMemo(() => buildGraph(allPerms), [allPerms])
  const groups = useMemo(() => groupPerms(rowPerms), [rowPerms])
  const [savingPos, setSavingPos] = useState(null)
  const [memberPos, setMemberPos] = useState(null) // vị trí đang mở modal thành viên

  async function toggle(posId, key, checked) {
    const cur = new Set(grants[posId] || [])
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
    setSavingPos(posId)
    try {
      const r = await saveGlobalPosition(posId, next)
      onGrantsChange(posId, r.perm_keys)
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingPos(null)
    }
  }

  return (
    <div className="perm-matrix-scroll">
      <table className="perm-matrix">
        <thead>
          <tr>
            <th className="perm-matrix-rowhead">Quyền \ Vị trí</th>
            {positions.map(p => (
              <th key={p.id} className={`perm-col${savingPos === p.id ? ' saving' : ''}`} title={`${p.name} — bấm để sửa thành viên`}>
                <button type="button" className="perm-pos-link" onClick={() => setMemberPos(p)}>{p.code || p.name}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([group, perms]) => (
            <PermGroupRows key={group} group={group} perms={perms} positions={positions} grants={grants} onToggle={toggle} />
          ))}
        </tbody>
      </table>
      {memberPos && <PositionMembersModal position={memberPos} onClose={() => setMemberPos(null)} />}
    </div>
  )
}

function PermGroupRows({ group, perms, positions, grants, onToggle }) {
  return (
    <>
      <tr className="perm-group-row"><td colSpan={positions.length + 1}>{group}</td></tr>
      {perms.map(perm => (
        <tr key={perm.key}>
          <td className="perm-matrix-rowhead">
            {perm.label}
            {perm.kind === 'section' && <span className="perm-section-tag" title="Xem một phần">phần</span>}
            {perm.adminOnly && <span className="perm-admin-tag" title="Mặc định chỉ admin">admin</span>}
          </td>
          {positions.map(pos => {
            const checked = (grants[pos.id] || []).includes(perm.key)
            return (
              <td key={pos.id} className="perm-cell">
                <input type="checkbox" checked={checked} onChange={e => onToggle(pos.id, perm.key, e.target.checked)} />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
