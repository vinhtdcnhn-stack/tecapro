import { useState } from 'react'
import { groupPerms, fetchUserOverrides, saveUserOverrides } from './permissionApi'

// Ghi đè quyền theo từng người dùng: allow (thêm) / deny (thu hồi, thắng allow).
// Quyền không tick gì = kế thừa từ position. Bao gồm quyền toàn cục (global) LẪN quyền
// chi tiết HĐ (contract-scope) — override quyền HĐ áp TOÀN CỤC cho MỌI hợp đồng của user.
export default function UserOverrideEditor({ globalPerms, contractPerms = [], users }) {
  const groups = groupPerms([...globalPerms, ...contractPerms])
  const [userId, setUserId] = useState('')
  const [allow, setAllow] = useState(() => new Set())
  const [deny, setDeny] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function pickUser(id) {
    setUserId(id); setMsg('')
    if (!id) { setAllow(new Set()); setDeny(new Set()); return }
    setLoading(true)
    try {
      const r = await fetchUserOverrides(id)
      setAllow(new Set(r.allow)); setDeny(new Set(r.deny))
    } catch (e) { setMsg(e.message) } finally { setLoading(false) }
  }

  function setEffect(key, effect) {
    setAllow(prev => { const s = new Set(prev); effect === 'allow' ? toggleIn(s, key) : s.delete(key); return s })
    setDeny(prev => { const s = new Set(prev); effect === 'deny' ? toggleIn(s, key) : s.delete(key); return s })
  }
  function toggleIn(set, key) { set.has(key) ? set.delete(key) : set.add(key) }

  async function save() {
    if (!userId) return
    setSaving(true); setMsg('')
    try {
      const r = await saveUserOverrides(userId, [...allow], [...deny])
      setAllow(new Set(r.allow)); setDeny(new Set(r.deny))
      setMsg('Đã lưu.')
    } catch (e) { setMsg(e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={userId} onChange={e => pickUser(e.target.value)} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
          <option value="">— Chọn người dùng —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name} {u.email ? `(${u.email})` : ''}</option>)}
        </select>
        {userId && <button className="add-btn" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu ghi đè'}</button>}
        {msg && <span style={{ color: msg === 'Đã lưu.' ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>

      {userId && !loading && (
        <p style={{ color: '#64748b', fontSize: 12.5, marginTop: -4 }}>
          Lưu ý: quyền nhóm <b>HĐ bán / HĐ nhập</b> ghi đè ở đây áp <b>toàn cục cho MỌI hợp đồng</b> của
          người dùng (không phụ thuộc vai trò trong từng HĐ).
        </p>
      )}
      {!userId && <p style={{ color: '#64748b' }}>Chọn người dùng để xem/đặt ghi đè. Để trống = theo vị trí.</p>}
      {loading && <p>Đang tải…</p>}

      {userId && !loading && (
        <div className="perm-override-grid">
          <span className="ov-head">Quyền</span><span className="ov-head">Cho phép</span><span className="ov-head">Thu hồi</span>
          {groups.map(([group, perms]) => (
            <Group key={group} group={group} perms={perms} allow={allow} deny={deny} onSet={setEffect} />
          ))}
        </div>
      )}
    </div>
  )
}

function Group({ group, perms, allow, deny, onSet }) {
  return (
    <>
      <div style={{ gridColumn: '1 / -1', fontWeight: 700, color: '#3730a3', marginTop: 6 }}>{group}</div>
      {perms.map(p => (
        <Row key={p.key} perm={p} allow={allow.has(p.key)} deny={deny.has(p.key)} onSet={onSet} />
      ))}
    </>
  )
}
function Row({ perm, allow, deny, onSet }) {
  return (
    <>
      <span>{perm.label}{perm.adminOnly && <span className="perm-admin-tag">admin</span>}</span>
      <input type="checkbox" checked={allow} onChange={() => onSet(perm.key, 'allow')} />
      <input type="checkbox" checked={deny} onChange={() => onSet(perm.key, 'deny')} />
    </>
  )
}
