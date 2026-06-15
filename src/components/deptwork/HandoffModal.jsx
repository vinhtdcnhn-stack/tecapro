import { useState } from 'react'
import Modal from '../common/Modal'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import useIsMobile from '../contracts/useIsMobile'

// Modal chuyển việc cho đồng nghiệp (cần người đó chấp nhận).
// excludeIds: những người đang là người nhận của việc (ẩn khỏi danh sách).
export default function HandoffModal({ members, excludeIds = [], onSubmit, onClose }) {
  const isMobile = useIsMobile()
  const [toUserId, setToUserId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const options = members.filter(m => m.is_active !== false && !excludeIds.includes(m.user_id))

  async function submit() {
    if (!toUserId) { alert('Vui lòng chọn người nhận.'); return }
    setSaving(true)
    const ok = await onSubmit(Number(toUserId), note.trim() || null)
    setSaving(false)
    if (ok) onClose()
  }

  const fields = (
    <>
      <Field label="Chuyển cho">
        <select value={toUserId} onChange={e => setToUserId(e.target.value)}>
          <option value="">— Chọn người nhận —</option>
          {options.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
          ))}
        </select>
      </Field>
      <Field label="Ghi chú cho người nhận">
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Lý do / bàn giao..." />
      </Field>
    </>
  )

  if (isMobile) {
    return (
      <MobileEditSheet title="Chuyển việc" onClose={onClose} onSave={submit} saving={saving} saveLabel="Chuyển">
        {fields}
      </MobileEditSheet>
    )
  }
  return (
    <Modal onClose={onClose} labelledBy="dw-handoff-title" width="440px">
      <div className="modal-header">
        <h2 id="dw-handoff-title">Chuyển việc</h2>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      <div className="modal-body dw-modal-body">{fields}</div>
      <div className="modal-footer">
        <button className="cancel-btn" onClick={onClose}>Hủy</button>
        <button className="save-btn" onClick={submit} disabled={saving}>{saving ? 'Đang chuyển…' : 'Chuyển'}</button>
      </div>
    </Modal>
  )
}
