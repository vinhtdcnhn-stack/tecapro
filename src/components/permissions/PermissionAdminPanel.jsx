import { useState, useEffect } from 'react'
import { useUsers } from '../../lib/queries'
import { fetchCatalog, fetchGlobalMatrix, fetchDepartmentMatrix, fetchContractMatrix } from './permissionApi'
import GlobalPermissionMatrix from './GlobalPermissionMatrix'
import DepartmentPermissionMatrix from './DepartmentPermissionMatrix'
import ContractRolePermissionMatrix from './ContractRolePermissionMatrix'
import UserOverrideEditor from './UserOverrideEditor'
import './permissions.css'

// Trang tổng (Hệ thống → Phân quyền): xem/sửa toàn bộ 3 ma trận. Panel Ctrl+Shift+Q là
// lối tắt theo từng trang; ở đây chỉnh đầy đủ.
export default function PermissionAdminPanel() {
  const { data: users = [] } = useUsers()
  const [tab, setTab] = useState('global')
  const [cat, setCat] = useState(null)
  const [global, setGlobal] = useState(null)
  const [department, setDepartment] = useState(null)
  const [contract, setContract] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [c, g, d, ct] = await Promise.all([
          fetchCatalog(), fetchGlobalMatrix(), fetchDepartmentMatrix(), fetchContractMatrix(),
        ])
        setCat(c); setGlobal(g); setDepartment(d); setContract(ct)
      } catch (e) { setErr(e.message) }
    })()
  }, [])

  if (err) return <p className="perm-err">{err}</p>
  if (!cat) return <p>Đang tải…</p>

  const globalPerms = cat.permissions.filter(p => p.scope === 'global')
  const contractPerms = cat.permissions.filter(p => p.scope === 'contract')

  return (
    <div className="perm-admin-page">
      <h2 className="section-title">PHÂN QUYỀN</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: -8 }}>
        Mẹo: ở bất kỳ trang nào, nhấn <b>Ctrl+Shift+Q</b> để mở nhanh bảng phân quyền của riêng trang đó.
      </p>
      <p style={{ color: '#92400e', fontSize: 12.5, background: '#fef3c7', padding: '6px 10px', borderRadius: 6 }}>
        ⓘ <b>Kế thừa trưởng/phó phòng:</b> Trưởng ban (TP) và Phó ban (PP) tự động có HỢP mọi quyền
        (toàn cục) mà thành viên cùng phòng được cấp — không cần tick riêng. Quy tắc áp tự động khi đăng nhập.
      </p>
      <div className="perm-admin-tabs">
        <button className={`perm-admin-tab${tab === 'global' ? ' active' : ''}`} onClick={() => setTab('global')}>Toàn cục (theo vị trí)</button>
        <button className={`perm-admin-tab${tab === 'department' ? ' active' : ''}`} onClick={() => setTab('department')}>Toàn cục (theo phòng ban)</button>
        <button className={`perm-admin-tab${tab === 'contract' ? ' active' : ''}`} onClick={() => setTab('contract')}>Theo vai trò hợp đồng</button>
        <button className={`perm-admin-tab${tab === 'user' ? ' active' : ''}`} onClick={() => setTab('user')}>Ghi đè theo người dùng</button>
      </div>

      {tab === 'global' && global && (
        // Ma trận vị trí cấp được CẢ quyền module (global) LẪN quyền chi tiết HĐ
        // (contract-scope) — quyền HĐ cấp theo vị trí áp toàn cục cho mọi hợp đồng.
        <GlobalPermissionMatrix
          rowPerms={[...globalPerms, ...contractPerms]} allPerms={cat.permissions} positions={global.positions} grants={global.grants}
          onGrantsChange={(posId, keys) => setGlobal(g => ({ ...g, grants: { ...g.grants, [posId]: keys } }))}
        />
      )}
      {tab === 'department' && department && (
        // Ma trận phòng ban: cấp quyền cho CẢ phòng — mọi user thuộc phòng có quyền
        // (song song với cấp theo vị trí). Cùng bộ quyền global + HĐ.
        <DepartmentPermissionMatrix
          rowPerms={[...globalPerms, ...contractPerms]} allPerms={cat.permissions} departments={department.departments} grants={department.grants}
          onGrantsChange={(depId, keys) => setDepartment(d => ({ ...d, grants: { ...d.grants, [depId]: keys } }))}
        />
      )}
      {tab === 'contract' && contract && (
        <ContractRolePermissionMatrix
          rowPerms={contractPerms} allPerms={cat.permissions} roles={contract.memberRoles} grants={contract.grants}
          onGrantsChange={(role, keys) => setContract(c => ({ ...c, grants: { ...c.grants, [role]: keys } }))}
        />
      )}
      {tab === 'user' && <UserOverrideEditor globalPerms={globalPerms} contractPerms={contractPerms} users={users} />}
    </div>
  )
}
