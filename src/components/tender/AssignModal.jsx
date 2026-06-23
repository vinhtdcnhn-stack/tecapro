import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { API } from '../../config/api'

// Trưởng phòng phân công người làm thầu + AM phụ trách. Danh sách người lấy từ HR
// (app_user) — không nhập tay. Người làm thầu mặc định gợi ý từ thành viên phòng.
export default function AssignModal({ tender, members = [], onClose, onSaved }) {
  const [users, setUsers] = useState([])
  const [bidMaker, setBidMaker] = useState(tender?.bid_maker_id || '')
  const [am, setAm] = useState(tender?.am_id || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API}/users`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]))
  }, [])

  // Người làm thầu: ưu tiên thành viên phòng; AM: mọi người dùng.
  const memberIds = new Set(members.map(m => Number(m.user_id)))
  const bidOptions = users.filter(u => memberIds.has(Number(u.id)))
  const bidList = bidOptions.length ? bidOptions : users

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const res = await fetch(`${API}/tender/${tender.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_maker_id: bidMaker || null, am_id: am || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Phân công thất bại.')
      onSaved?.(data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={460} labelledBy="assign-modal-title">
      <div className="modal-header">
        <h3 id="assign-modal-title">Phân công gói thầu</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
        <label className="field">
          <span>Người làm thầu</span>
          <select value={bidMaker} onChange={e => setBidMaker(e.target.value)}>
            <option value="">— Chưa giao —</option>
            {bidList.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>AM phụ trách</span>
          <select value={am} onChange={e => setAm(e.target.value)}>
            <option value="">— Không —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Hủy</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Phân công'}
        </button>
      </div>
    </Modal>
  )
}
