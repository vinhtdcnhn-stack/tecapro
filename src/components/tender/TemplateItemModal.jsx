import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { API } from '../../config/api'

// Tạo / sửa một đầu việc trong MẪU checklist dùng chung.
// Mẫu chỉ giữ tiêu đề / mô tả / phòng ban mặc định (không người phụ trách & hạn).
export default function TemplateItemModal({ item, parentId, onClose, onSaved }) {
  const editing = !!item?.id
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState(() => ({
    title: item?.title || '',
    description: item?.description || '',
    department_id: item?.department_id || '',
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API}/departments`).then(r => r.ok ? r.json() : []).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    if (!form.title.trim()) { setErr('Tên đầu việc không được để trống.'); return }
    setSaving(true); setErr('')
    try {
      const url = editing ? `${API}/tender/checklist-template/${item.id}` : `${API}/tender/checklist-template`
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
    <Modal onClose={onClose} width={520} labelledBy="tpl-modal-title" className="tender-form-modal">
      <div className="modal-header">
        <h3 id="tpl-modal-title">{editing ? 'Sửa đầu việc mẫu' : (parentId ? 'Thêm việc con (mẫu)' : 'Thêm đầu việc mẫu')}</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
        <label className="field"><span>Tên đầu việc *</span>
          <input value={form.title} onChange={set('title')} autoFocus /></label>
        <label className="field"><span>Mô tả</span>
          <textarea rows={2} value={form.description} onChange={set('description')} /></label>
        <label className="field"><span>Phòng ban mặc định</span>
          <select value={form.department_id} onChange={set('department_id')}>
            <option value="">—</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
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
