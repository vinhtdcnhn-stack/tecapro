import { useState, useEffect, useRef } from 'react'
import Modal from '../common/Modal'
import MobileEditSheet, { Field } from '../contracts/MobileEditSheet'
import useIsMobile from '../contracts/useIsMobile'
import DateInput from '../contracts/DateInput'
import { API, API_BASE } from '../../config/api'
import { PRIORITIES } from './deptWorkUtils'

const fmtSize = (b) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

// Modal tạo/sửa việc của phòng. Desktop = Modal; mobile = bottom sheet.
// canManage (head/deputy/admin): giao cho nhiều người + chọn nhóm trưởng + nguồn nội bộ/khách.
// Nhân viên thường: chỉ tạo việc khách hàng, tự nhận (backend ép) → form rút gọn.
export default function DeptWorkTaskModal({ task, members, teams, canManage, onSave, onClose }) {
  const isEdit = !!task
  const isMobile = useIsMobile()

  const initialAssignees = task?.assignees?.map(a => a.assignee_id) ?? []
  const initialLead = task?.assignees?.find(a => a.is_lead)?.assignee_id ?? null

  const [form, setForm] = useState({
    title:        task?.title        ?? '',
    description:  task?.description  ?? '',
    instructions: task?.instructions ?? '',
    team_id:      task?.team_id      ?? '',
    priority:     task?.priority     ?? 'Bình thường',
    due_date:     task?.due_date?.slice(0, 10) ?? '',
    origin:       task?.origin       ?? (canManage ? 'internal' : 'customer'),
    customer_name:    task?.customer_name    ?? '',
    customer_contact: task?.customer_contact ?? '',
  })
  const [assigneeIds, setAssigneeIds] = useState(initialAssignees)
  const [leadId, setLeadId] = useState(initialLead)
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState([])   // tệp đã có (chế độ sửa)
  const [pendingFiles, setPendingFiles] = useState([])  // tệp đang chờ tải lên
  const fileRef = useRef(null)

  // Chế độ sửa: nạp danh sách tệp đã đính kèm.
  useEffect(() => {
    if (!isEdit || !task?.id) return
    fetch(`${API}/dept-work/tasks/${task.id}/attachments`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAttachments(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [isEdit, task?.id])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length) setPendingFiles(prev => [...prev, ...files])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteExisting(att) {
    if (!confirm(`Xóa tệp "${att.file_name}"?`)) return
    try {
      const res = await fetch(`${API}/dept-work/task-attachments/${att.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Xóa thất bại'); return }
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch { alert('Có lỗi khi xóa tệp.') }
  }

  function toggleAssignee(uid) {
    setAssigneeIds(prev => {
      const next = prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
      if (!next.includes(leadId)) setLeadId(next[0] ?? null)
      return next
    })
  }

  async function handleSubmit() {
    if (!form.title.trim()) { alert('Vui lòng nhập tên công việc.'); return }
    const payload = {
      title: form.title, description: form.description, instructions: form.instructions,
      team_id: form.team_id || null, priority: form.priority, due_date: form.due_date || null,
      customer_name: form.customer_name, customer_contact: form.customer_contact,
    }
    if (canManage) {
      payload.origin = form.origin
      payload.assignees = assigneeIds.map(uid => ({ user_id: uid, is_lead: uid === leadId }))
    }
    setSaving(true)
    const saved = await onSave(payload)   // trả về việc đã lưu (có id) hoặc null
    if (!saved) { setSaving(false); return }

    // Tải các tệp đang chờ lên việc vừa lưu (tạo mới hoặc đang sửa).
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      try { await fetch(`${API}/dept-work/tasks/${saved.id}/attachments`, { method: 'POST', body: fd }) }
      catch { /* bỏ qua tệp lỗi, tiếp tục */ }
    }
    setSaving(false)
    onClose()
  }

  const showCustomer = !canManage || form.origin === 'customer'

  const fields = (
    <>
      <Field label="Tên công việc *" className="dw-full">
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Nhập tên công việc..." />
      </Field>
      <Field label="Mô tả" className="dw-full">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Mô tả chi tiết..." />
      </Field>
      <Field label="Chỉ đạo / yêu cầu cụ thể" className="dw-full">
        <textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Hướng dẫn cho người thực hiện..." />
      </Field>

      <Field label="Nhóm">
        <select value={form.team_id} onChange={e => set('team_id', e.target.value)}>
          <option value="">— Không —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Ưu tiên">
        <select value={form.priority} onChange={e => set('priority', e.target.value)}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="Thời hạn hoàn thành">
        <DateInput value={form.due_date} onChange={e => set('due_date', e.target.value)} />
      </Field>
      {canManage && (
        <Field label="Nguồn việc">
          <select value={form.origin} onChange={e => set('origin', e.target.value)}>
            <option value="internal">Nội bộ</option>
            <option value="customer">Khách hàng</option>
          </select>
        </Field>
      )}

      {showCustomer && (
        <>
          <Field label="Tên khách hàng">
            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Khách báo việc..." />
          </Field>
          <Field label="Liên hệ khách">
            <input value={form.customer_contact} onChange={e => set('customer_contact', e.target.value)} placeholder="SĐT / email..." />
          </Field>
        </>
      )}

      {canManage ? (
        <Field label="Giao cho (chọn người, ★ = nhóm trưởng)" className="dw-full">
          <div className="dw-assignee-list">
            {members.filter(m => m.is_active !== false).map(m => {
              const checked = assigneeIds.includes(m.user_id)
              return (
                <div key={m.user_id} className={`dw-assignee-row${checked ? ' picked' : ''}`}>
                  <label className="dw-assignee-pick">
                    <input type="checkbox" checked={checked} onChange={() => toggleAssignee(m.user_id)} />
                    <span>{m.full_name}{m.team_name ? ` · ${m.team_name}` : ''}</span>
                  </label>
                  {checked && (
                    <label className={`dw-lead-pick${leadId === m.user_id ? ' on' : ''}`} title="Đặt làm nhóm trưởng">
                      <input type="radio" name="dw-lead" checked={leadId === m.user_id} onChange={() => setLeadId(m.user_id)} />
                      <span>★ Nhóm trưởng</span>
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </Field>
      ) : (
        <p className="dw-note dw-full">Việc khách hàng — bạn sẽ tự nhận và là nhóm trưởng. Nếu không tự xử lý được, hãy "Đẩy cấp trên" sau khi tạo.</p>
      )}

      <Field label="Tài liệu đính kèm" className="dw-full">
        <div className="dw-att-list">
          {attachments.map(att => (
            <div key={`e-${att.id}`} className="dw-att-item">
              <a href={`${API_BASE}${att.file_path}`} target="_blank" rel="noreferrer" className="dw-att-name" title={att.file_name}>📎 {att.file_name}</a>
              <span className="dw-att-size">{fmtSize(att.file_size)}</span>
              <button type="button" className="dw-att-del" onClick={() => deleteExisting(att)} title="Xóa">✕</button>
            </div>
          ))}
          {pendingFiles.map((f, i) => (
            <div key={`p-${i}`} className="dw-att-item dw-att-pending">
              <span className="dw-att-name" title={f.name}>📎 {f.name}</span>
              <span className="dw-att-size">{fmtSize(f.size)}</span>
              <button type="button" className="dw-att-del" onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} title="Bỏ">✕</button>
            </div>
          ))}
          {attachments.length === 0 && pendingFiles.length === 0 && <p className="dash-empty">Chưa có tệp.</p>}
        </div>
        <label className="dw-att-add">
          + Chọn tệp
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
        </label>
      </Field>
    </>
  )

  const title = isEdit ? 'Cập nhật công việc' : 'Thêm công việc'

  if (isMobile) {
    return (
      <MobileEditSheet title={title} onClose={onClose} onSave={handleSubmit} saving={saving} saveLabel={isEdit ? 'Cập nhật' : 'Tạo việc'}>
        {fields}
      </MobileEditSheet>
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="dw-task-modal-title" width="640px">
      <div className="modal-header">
        <h2 id="dw-task-modal-title">{title}</h2>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      <div className="modal-body dw-modal-body">{fields}</div>
      <div className="modal-footer">
        <button className="cancel-btn" onClick={onClose}>Hủy</button>
        <button className="save-btn" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Đang lưu…' : (isEdit ? 'Cập nhật' : 'Tạo việc')}
        </button>
      </div>
    </Modal>
  )
}
