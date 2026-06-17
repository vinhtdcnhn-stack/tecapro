import { useState, useEffect, useCallback } from 'react'
import { API } from '../../../config/api'
import Modal from '../../common/Modal'
import FormBuilder from './FormBuilder'

const EMPTY = { code: '', name: '', icon: '', description: '', sort_order: 0, is_active: true }

// Bộ emoji gợi ý cho các loại đơn thường gặp.
const ICON_PRESETS = ['🏖️', '🤒', '💰', '🧾', '🛒', '✈️', '🚗', '🕒', '📝', '📄', '✍️', '🔧', '📦', '🎓', '🏥', '🏢']

// Danh sách + tạo/sửa/xóa loại đơn (admin). Bấm "Cấu hình" để mở FormBuilder.
export default function FormList() {
  const [forms, setForms] = useState([])
  const [builderId, setBuilderId] = useState(null)
  const [modal, setModal] = useState(null) // { mode:'create'|'edit', data }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    fetch(`${API}/approvals/forms`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setForms(Array.isArray(d) ? d : []))
      .catch(() => setForms([]))
  }, [])
  useEffect(() => { load() }, [load])

  function openCreate() { setError(''); setModal({ mode: 'create', data: { ...EMPTY } }) }
  function openEdit(f) { setError(''); setModal({ mode: 'edit', data: { ...f } }) }

  async function save() {
    const d = modal.data
    if (!d.name?.trim() || (modal.mode === 'create' && !d.code?.trim())) {
      setError('Mã và tên không được để trống.'); return
    }
    setSaving(true)
    try {
      const url = modal.mode === 'create'
        ? `${API}/approvals/forms`
        : `${API}/approvals/forms/${d.id}`
      const r = await fetch(url, {
        method: modal.mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Lưu thất bại.')
      setModal(null); load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(f) {
    if (!confirm(`Xóa loại đơn "${f.name}"?`)) return
    const r = await fetch(`${API}/approvals/forms/${f.id}`, { method: 'DELETE' })
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Không thể xóa.'); return }
    load()
  }

  if (builderId) {
    return <FormBuilder formId={builderId} onBack={() => { setBuilderId(null); load() }} />
  }

  return (
    <div className="ab-admin-page">
      <div className="ab-section-head">
        <h2 className="section-title" style={{ margin: 0 }}>LOẠI ĐƠN (CẤU HÌNH)</h2>
        <button type="button" className="btn btn-primary" onClick={openCreate}>+ Thêm loại đơn</button>
      </div>

      {forms.length === 0 && <p className="approval-empty">Chưa có loại đơn nào. Bấm "Thêm loại đơn".</p>}

      <div className="ab-form-grid">
        {forms.map(f => (
          <div key={f.id} className={`ab-form-card${f.is_active ? '' : ' ab-inactive'}`}>
            <div className="ab-form-card-top">
              <span className="ab-form-icon">{f.icon || '📄'}</span>
              <div className="ab-form-meta">
                <div className="ab-form-name">{f.name}</div>
                <div className="ab-form-code">{f.code}{!f.is_active && ' · Ngừng dùng'}</div>
              </div>
            </div>
            <div className="ab-form-counts">{f.field_count} trường · {f.step_count} bước duyệt</div>
            <div className="ab-form-card-actions">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setBuilderId(f.id)}>Cấu hình</button>
              <button type="button" className="btn btn-sm" onClick={() => openEdit(f)}>Sửa</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(f)}>Xóa</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal isOpen onClose={() => setModal(null)} labelledBy="ab-form-modal-title" width="480px">
          <div className="modal-header"><h2 id="ab-form-modal-title">{modal.mode === 'create' ? 'Thêm loại đơn' : 'Sửa loại đơn'}</h2></div>
          <div className="modal-body">
            {error && <p className="ab-error">{error}</p>}
            <label className="ab-flabel">Mã loại đơn
              <input
                className="ab-input" value={modal.data.code}
                disabled={modal.mode === 'edit'}
                placeholder="VD: LEAVE"
                onChange={e => setModal(m => ({ ...m, data: { ...m.data, code: e.target.value } }))}
              />
            </label>
            <label className="ab-flabel">Tên hiển thị
              <input
                className="ab-input" value={modal.data.name}
                placeholder="VD: Đơn xin nghỉ phép"
                onChange={e => setModal(m => ({ ...m, data: { ...m.data, name: e.target.value } }))}
              />
            </label>
            <div className="ab-flabel">Icon (chọn hoặc gõ emoji)
              <div className="ab-icon-picker">
                {ICON_PRESETS.map(ic => (
                  <button
                    key={ic} type="button"
                    className={`ab-icon-opt${modal.data.icon === ic ? ' is-selected' : ''}`}
                    onClick={() => setModal(m => ({ ...m, data: { ...m.data, icon: ic } }))}
                  >{ic}</button>
                ))}
                <input
                  className="ab-input ab-icon-input" value={modal.data.icon || ''}
                  placeholder="tự gõ" maxLength={4}
                  onChange={e => setModal(m => ({ ...m, data: { ...m.data, icon: e.target.value } }))}
                />
              </div>
            </div>
            <label className="ab-flabel">Mô tả
              <textarea
                className="ab-input" rows={2} value={modal.data.description || ''}
                onChange={e => setModal(m => ({ ...m, data: { ...m.data, description: e.target.value } }))}
              />
            </label>
            <div className="ab-flabel-row">
              <label className="ab-flabel" style={{ flex: 1 }}>Thứ tự hiển thị (nhỏ lên trước)
                <input
                  className="ab-input" type="number" value={modal.data.sort_order ?? 0}
                  onChange={e => setModal(m => ({ ...m, data: { ...m.data, sort_order: Number(e.target.value) } }))}
                />
              </label>
              {modal.mode === 'edit' && (
                <label className="ab-check" style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>
                  <input
                    type="checkbox" checked={modal.data.is_active !== false}
                    onChange={e => setModal(m => ({ ...m, data: { ...m.data, is_active: e.target.checked } }))}
                  /> Đang dùng
                </label>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={() => setModal(null)}>Hủy</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
