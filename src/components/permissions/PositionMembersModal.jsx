import { useEffect, useMemo, useState } from 'react'
import { fetchPositionMembers, addPositionMember, removePositionMember } from './permissionApi'

// Modal thêm/bớt người vào MỘT vị trí (bấm vào header cột vị trí trong ma trận Lớp A).
// Sửa app_user_position; ảnh hưởng quyền toàn cục cấp theo vị trí.
export default function PositionMembersModal({ position, onClose }) {
  const [members, setMembers] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true); setErr('')
    try {
      const r = await fetchPositionMembers(position.id)
      setMembers(r.members || [])
      setCandidates(r.candidates || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- nạp dữ liệu async khi mở/đổi vị trí
  useEffect(() => { load() }, [position.id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return candidates
    return candidates.filter(c =>
      (c.full_name || '').toLowerCase().includes(s) ||
      (c.department_name || '').toLowerCase().includes(s),
    )
  }, [candidates, q])

  async function add(userId) {
    setBusy(true); setErr('')
    try { await addPositionMember(position.id, userId); await load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function remove(userId) {
    setBusy(true); setErr('')
    try { await removePositionMember(position.id, userId); await load() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="pos-mem-backdrop" onClick={onClose}>
      <div className="pos-mem-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-mem-head">
          <strong>Thành viên vị trí — {position.code || position.name}</strong>
          {position.code && position.name && position.code !== position.name && (
            <span className="pos-mem-sub">{position.name}</span>
          )}
          <button onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="pos-mem-body">
          {err && <p className="perm-err">{err}</p>}
          {loading ? <p>Đang tải…</p> : (
            <div className="pos-mem-cols">
              <div className="pos-mem-col">
                <div className="pos-mem-coltitle">Đang giữ vị trí ({members.length})</div>
                {members.length === 0 && <p className="pos-mem-empty">Chưa có ai.</p>}
                <ul className="pos-mem-list">
                  {members.map(m => (
                    <li key={m.id}>
                      <span className="pos-mem-name">
                        {m.full_name}
                        {m.department_name && <em>{m.department_name}</em>}
                      </span>
                      <button className="pos-mem-rm" disabled={busy} onClick={() => remove(m.id)} title="Gỡ khỏi vị trí">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pos-mem-col">
                <div className="pos-mem-coltitle">Thêm người</div>
                <input
                  className="pos-mem-search" placeholder="Tìm theo tên / phòng ban…"
                  value={q} onChange={e => setQ(e.target.value)} autoFocus
                />
                <ul className="pos-mem-list">
                  {filtered.map(c => (
                    <li key={c.id}>
                      <span className="pos-mem-name">
                        {c.full_name}
                        {c.department_name && <em>{c.department_name}</em>}
                      </span>
                      <button className="pos-mem-add" disabled={busy} onClick={() => add(c.id)} title="Thêm vào vị trí">+ Thêm</button>
                    </li>
                  ))}
                  {filtered.length === 0 && <li className="pos-mem-empty">Không có ứng viên phù hợp.</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
        <div className="pos-mem-foot">
          Thêm/gỡ áp dụng ngay. Quyền theo vị trí ảnh hưởng mọi người liên quan. Đóng: Esc.
        </div>
      </div>
    </div>
  )
}
