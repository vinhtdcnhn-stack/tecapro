import { useState, useEffect } from 'react'
import { API } from '../../config/api'
import Modal from '../common/Modal'
import MultiSelect from '../common/MultiSelect'
import DynamicFields from './DynamicFields'

// Tạo mới hoặc sửa đơn nháp. Khi tạo: chọn loại đơn → render trường động.
// onDone(action) gọi sau khi lưu/gửi thành công để cha refresh ('saved' | 'submitted').
export default function RequestForm({ existing, onClose, onDone }) {
  const isEdit = !!existing
  const [forms, setForms] = useState([])
  const [users, setUsers] = useState([])
  const [formId, setFormId] = useState(existing?.form_id ? String(existing.form_id) : '')
  const [schema, setSchema] = useState(null)
  const [title, setTitle] = useState(existing?.title || '')
  const [values, setValues] = useState(existing?.form_data || {})
  const [picked, setPicked] = useState({})   // { [stepId]: [userId,...] } cho bước "người gửi tự chọn"
  const [files, setFiles] = useState([])     // tệp đính kèm tạm, upload sau khi tạo/lưu đơn
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const userOptions = users.map(u => ({
    value: String(u.id), label: u.full_name || u.email || `#${u.id}`, search: u.email || '', hint: u.email || '',
  }))

  // Tải danh sách loại đơn (khi tạo mới) + danh sách nhân viên (cho trường kiểu user).
  useEffect(() => {
    if (!isEdit) {
      fetch(`${API}/approvals/form-options`).then(r => r.ok ? r.json() : []).then(d => setForms(Array.isArray(d) ? d : []))
    }
    fetch(`${API}/approvals/user-options`).then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d : []))
  }, [isEdit])

  // Tải sơ đồ form khi đã chọn loại đơn.
  useEffect(() => {
    if (!formId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset sơ đồ khi bỏ chọn loại đơn
      setSchema(null)
      return
    }
    fetch(`${API}/approvals/forms/${formId}/schema`).then(r => r.ok ? r.json() : null).then(setSchema)
  }, [formId])

  function setValue(key, val) { setValues(v => ({ ...v, [key]: val })) }

  async function persist(submit) {
    setError('')
    if (!formId) { setError('Hãy chọn loại đơn.'); return }
    if (!title.trim()) { setError('Hãy nhập tiêu đề.'); return }
    // Khi gửi: bước "người gửi tự chọn" phải có người duyệt.
    if (submit) {
      const missing = (schema?.steps || []).filter(s => s.approver_source === 'requester_pick' && !(picked[s.id]?.length))
      if (missing.length) { setError(`Hãy chọn người duyệt cho bước: ${missing.map(s => s.name).join(', ')}`); return }
    }
    setBusy(true)
    try {
      let id = existing?.id
      // Lưu (tạo mới hoặc cập nhật) bản nháp trước.
      if (isEdit) {
        const r = await fetch(`${API}/approvals/requests/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), form_data: values }),
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Lưu thất bại.')
      } else {
        const r = await fetch(`${API}/approvals/requests`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_id: Number(formId), title: title.trim(), form_data: values }),
        })
        const b = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(b.error || 'Tạo đơn thất bại.')
        id = b.id
      }
      // Upload các tệp đính kèm vừa chọn (nếu có) lên đơn vừa tạo/lưu.
      for (const file of files) {
        const afd = new FormData()
        afd.append('file', file)
        const ar = await fetch(`${API}/approvals/requests/${id}/attachments`, { method: 'POST', body: afd })
        if (!ar.ok) throw new Error((await ar.json().catch(() => ({}))).error || `Tải tệp "${file.name}" thất bại.`)
      }
      setFiles([])
      // Nếu gửi duyệt, gọi submit (kèm người duyệt do người gửi chọn nếu có).
      if (submit) {
        const r = await fetch(`${API}/approvals/requests/${id}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepApprovers: picked }),
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Gửi duyệt thất bại.')
      }
      onDone(submit ? 'submitted' : 'saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} labelledBy="ar-form-title" width="820px">
      <div className="modal-header"><h2 id="ar-form-title">{isEdit ? 'Sửa đơn nháp' : 'Tạo đơn mới'}</h2></div>
      <div className="modal-body">
        {error && <p className="ab-error">{error}</p>}

        {!isEdit && (
          <label className="ab-flabel">Loại đơn
            <select className="ab-input" value={formId} onChange={e => { setFormId(e.target.value); setValues({}) }}>
              <option value="">— Chọn loại đơn —</option>
              {forms.map(f => <option key={f.id} value={String(f.id)}>{f.icon ? `${f.icon} ` : ''}{f.name}</option>)}
            </select>
          </label>
        )}

        <label className="ab-flabel">Tiêu đề
          <input className="ab-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề ngắn gọn" />
        </label>

        {schema && (
          <DynamicFields
            fields={schema.fields || []} values={values} onChange={setValue} users={users}
            pendingFiles={files}
            onPickFiles={fs => setFiles(prev => [...prev, ...fs])}
            onRemoveFile={i => setFiles(prev => prev.filter((_, idx) => idx !== i))}
          />
        )}

        {schema?.steps?.length > 0 && (
          <div className="ar-chain">
            <div className="ab-sublabel" style={{ marginBottom: 6 }}>Quy trình duyệt</div>
            {schema.steps.map((s, i) => (
              <div key={s.id || i} className="ar-chain-step">
                <b>{i + 1}. {s.name}</b>
                {s.approver_source === 'fixed' && (
                  <span className="ar-note"> — {s.approvers?.map(a => a.approver_name).filter(Boolean).join(', ') || '(chưa cấu hình)'}</span>
                )}
                {s.approver_source === 'direct_manager' && <span className="ar-note"> — Quản lý trực tiếp của bạn</span>}
                {s.approver_source === 'requester_pick' && (
                  <div style={{ marginTop: 4 }}>
                    <MultiSelect
                      options={userOptions}
                      selectedValues={picked[s.id] || []}
                      onChange={ids => setPicked(p => ({ ...p, [s.id]: ids }))}
                      placeholder="Gõ tên hoặc email để tìm…"
                      inlineSearch
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {schema?.followers?.length > 0 && (
          <div className="ar-chain">
            <div className="ab-sublabel" style={{ marginBottom: 6 }}>Người theo dõi</div>
            <div className="ar-followers">
              {schema.followers.map(fl => (
                <span key={fl.user_id} className="ar-follower-chip">{fl.full_name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-light" onClick={onClose}>Hủy</button>
        <button type="button" className="btn" onClick={() => persist(false)} disabled={busy}>Lưu nháp</button>
        <button type="button" className="btn btn-primary" onClick={() => persist(true)} disabled={busy}>
          {busy ? 'Đang xử lý…' : 'Gửi duyệt'}
        </button>
      </div>
    </Modal>
  )
}
