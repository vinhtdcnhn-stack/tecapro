import { useState, useEffect } from 'react'
import { API } from '../../../config/api'
import MultiSelect from '../../common/MultiSelect'
import FieldEditor from './FieldEditor'
import StepEditor from './StepEditor'

// Cấu hình chi tiết một loại đơn: các trường + chuỗi bước duyệt.
export default function FormBuilder({ formId, onBack }) {
  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [steps, setSteps] = useState([])
  const [followers, setFollowers] = useState([])   // mảng id string
  const [departments, setDepartments] = useState([]) // mảng id string (phòng ban được dùng)
  const [userOptions, setUserOptions] = useState([])
  const [deptOptions, setDeptOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/approvals/forms/${formId}`).then(r => r.ok ? r.json() : null),
      fetch(`${API}/approvals/user-options`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`).then(r => r.ok ? r.json() : []),
    ]).then(([f, users, depts]) => {
      if (f) {
        setForm(f)
        setFields(f.fields || [])
        setSteps((f.steps || []).map(s => ({
          name: s.name, rule: s.rule, approver_source: s.approver_source || 'fixed',
          approvers: (s.approvers || []).map(a => ({ approver_type: a.approver_type, approver_ref: String(a.approver_ref) })),
        })))
        setFollowers((f.followers || []).map(fl => String(fl.user_id)))
        setDepartments((f.departments || []).map(d => String(d.department_id)))
      }
      setUserOptions((Array.isArray(users) ? users : []).map(u => ({
        value: String(u.id), label: u.full_name || u.email || `#${u.id}`, search: u.email || '', hint: u.email || '',
      })))
      setDeptOptions((Array.isArray(depts) ? depts : []).map(d => ({
        value: String(d.id), label: d.name || `#${d.id}`, search: d.code || '', hint: d.code || '',
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
      const r3 = await fetch(`${API}/approvals/forms/${formId}/followers`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: followers.map(Number) }),
      })
      if (!r3.ok) throw new Error((await r3.json().catch(() => ({}))).error || 'Lưu người theo dõi thất bại.')
      const r4 = await fetch(`${API}/approvals/forms/${formId}/departments`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_ids: departments.map(Number) }),
      })
      if (!r4.ok) throw new Error((await r4.json().catch(() => ({}))).error || 'Lưu phòng ban áp dụng thất bại.')
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
      <div className="ab-section">
        <div className="ab-section-head">
          <h3>Phòng ban được dùng</h3>
        </div>
        <p className="ar-note" style={{ marginTop: 0 }}>
          Chỉ nhân sự thuộc các phòng ban được chọn mới <b>tạo được</b> loại đơn này.
          <b> Để trống = áp dụng cho mọi phòng ban.</b>
        </p>
        <MultiSelect
          options={deptOptions}
          selectedValues={departments}
          onChange={setDepartments}
          placeholder="Gõ tên hoặc mã phòng ban để giới hạn…"
          inlineSearch
        />
      </div>
      <div className="ab-section">
        <div className="ab-section-head">
          <h3>Người theo dõi</h3>
        </div>
        <p className="ar-note" style={{ marginTop: 0 }}>
          Những người này được <b>xem</b> đề xuất và <b>nhận thông báo</b> về diễn biến.
          Người gửi không thay đổi được.
        </p>
        <MultiSelect
          options={userOptions}
          selectedValues={followers}
          onChange={setFollowers}
          placeholder="Gõ tên hoặc email để thêm người theo dõi…"
          inlineSearch
        />
      </div>
    </div>
  )
}
