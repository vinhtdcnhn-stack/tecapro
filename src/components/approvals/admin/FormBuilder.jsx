import { useState, useEffect } from 'react'
import { API } from '../../../config/api'
import FieldEditor from './FieldEditor'
import StepEditor from './StepEditor'

// Cấu hình chi tiết một loại đơn: các trường + chuỗi bước duyệt.
export default function FormBuilder({ formId, onBack }) {
  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [steps, setSteps] = useState([])
  const [userOptions, setUserOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/approvals/forms/${formId}`).then(r => r.ok ? r.json() : null),
      fetch(`${API}/approvals/user-options`).then(r => r.ok ? r.json() : []),
    ]).then(([f, users]) => {
      if (f) {
        setForm(f)
        setFields(f.fields || [])
        setSteps((f.steps || []).map(s => ({
          name: s.name, rule: s.rule, approver_source: s.approver_source || 'fixed',
          approvers: (s.approvers || []).map(a => ({ approver_type: a.approver_type, approver_ref: String(a.approver_ref) })),
        })))
      }
      setUserOptions((Array.isArray(users) ? users : []).map(u => ({
        value: String(u.id), label: u.full_name || u.email || `#${u.id}`, search: u.email || '', hint: u.email || '',
      })))
    }).catch(() => setError('Không tải được cấu hình loại đơn.'))
  }, [formId])

  async function saveAll() {
    setError('')
    // Kiểm tra nhanh phía client.
    for (const f of fields) {
      if (!f.label?.trim() || !f.field_key?.trim()) { setError('Mỗi trường cần nhãn và khóa.'); return }
    }
    for (const s of steps) {
      if (!s.name?.trim()) { setError('Mỗi bước duyệt cần có tên.'); return }
      // Chỉ bước nguồn 'cố định' mới bắt buộc chọn sẵn người duyệt.
      if ((s.approver_source || 'fixed') === 'fixed' && !s.approvers?.length) {
        setError(`Bước "${s.name || ''}" cần ít nhất một người duyệt.`); return
      }
    }
    setSaving(true)
    try {
      const r1 = await fetch(`${API}/approvals/forms/${formId}/fields`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields.map(({ _autoKey, id, ...rest }) => rest) }),
      })
      if (!r1.ok) throw new Error((await r1.json().catch(() => ({}))).error || 'Lưu trường thất bại.')
      const r2 = await fetch(`${API}/approvals/forms/${formId}/steps`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error || 'Lưu bước duyệt thất bại.')
      alert('Đã lưu cấu hình loại đơn.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div>
        <button type="button" className="btn btn-light" onClick={onBack}>← Quay lại</button>
        <p className="approval-empty">{error || 'Đang tải…'}</p>
      </div>
    )
  }

  return (
    <div className="ab-builder">
      <div className="ab-builder-head">
        <button type="button" className="btn btn-light" onClick={onBack}>← Quay lại</button>
        <h2 className="section-title" style={{ margin: 0 }}>
          {form.icon ? `${form.icon} ` : ''}{form.name} <small className="ab-code">({form.code})</small>
        </h2>
        <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
      </div>
      {error && <p className="ab-error">{error}</p>}
      <FieldEditor fields={fields} onChange={setFields} />
      <StepEditor steps={steps} onChange={setSteps} userOptions={userOptions} />
    </div>
  )
}
