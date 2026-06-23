import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import DateInput from '../contracts/DateInput'
import { API } from '../../config/api'

// Tạo / sửa một đầu việc trong checklist. Phòng ban + người phụ trách lấy từ HR.
export default function ChecklistItemModal({ tenderId, item, parentId, onClose, onSaved }) {
  const editing = !!item?.id
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(() => ({
    title: item?.title || '',
    description: item?.description || '',
    department_id: item?.department_id || '',
    assignee_id: item?.assignee_id || '',
    due_date: item?.due_date ? String(item.due_date).slice(0, 10) : '',
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API}/departments`).then(r => r.ok ? r.json() : []).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API}/users`).then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }))

  // Đổi phòng ban: lọc lại người phụ trách, bỏ chọn nếu người đang chọn không thuộc phòng ban mới.
  const onDepartmentChange = (e) => {
    const department_id = e.target.value
    setForm(f => {
      const stillValid = !department_id || users.some(u => String(u.id) === String(f.assignee_id) && String(u.department_id) === String(department_id))
      return { ...f, department_id, assignee_id: stillValid ? f.assignee_id : '' }
    })
  }

  // Chỉ hiện nhân sự thuộc phòng ban đã chọn (chưa chọn phòng ban thì hiện tất cả).
  const assigneeOptions = form.department_id
    ? users.filter(u => String(u.department_id) === String(form.department_id))
    : users

  async function handleSave() {
    if (!form.title.trim()) { setErr('Tên đầu việc không được để trống.'); return }
    setSaving(true); setErr('')
    try {
      const url = editing ? `${API}/tender/checklist/${item.id}` : `${API}/tender/${tenderId}/checklist`
      const body = { ...form }
      if (!editing && parentId) body.parent_item_id = parentId
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.')
      onSaved?.(data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={560} labelledBy="ci-modal-title" className="tender-form-modal">
      <div className="modal-header">
        <h3 id="ci-modal-title">{editing ? 'Sửa đầu việc' : (parentId ? 'Thêm việc con' : 'Thêm đầu việc')}</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
        <label className="field"><span>Tên đầu việc *</span>
          <input value={form.title} onChange={set('title')} autoFocus /></label>
        <label className="field"><span>Mô tả</span>
          <textarea rows={2} value={form.description} onChange={set('description')} /></label>
        <div className="tender-form-grid">
          <label className="field"><span>Phòng ban chuyên môn</span>
            <select value={form.department_id} onChange={onDepartmentChange}>
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <label className="field"><span>Người phụ trách</span>
            <select value={form.assignee_id} onChange={set('assignee_id')}>
              <option value="">—</option>
              {assigneeOptions.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select></label>
          <label className="field"><span>Hạn</span>
            <DateInput value={form.due_date} onChange={set('due_date')} /></label>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Hủy</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </Modal>
  )
}
