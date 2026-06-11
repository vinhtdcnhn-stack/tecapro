import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput from './DateInput'

import { CASE_STATUSES, PRIORITIES, caseStatusModalCls } from './warrantyUtils'

// ── Case Form Modal ───────────────────────────────────────────────────────────

export default function CaseFormModal({ caseData, defaultCaseNo, onSave, onClose }) {
  const isEdit = !!caseData
  const [form, setForm] = useState({
    case_no: caseData?.case_no||defaultCaseNo,
    title:   caseData?.title||'',
    description: caseData?.description||'',
    reported_by: caseData?.reported_by||'',
    reported_date: caseData?.reported_date?.slice(0,10)||new Date().toISOString().slice(0,10),
    priority: caseData?.priority||'Bình thường',
    status:   caseData?.status||'Tiếp nhận',
    note:     caseData?.note||'',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleSubmit() {
    if (!form.title.trim()) { setErr('Tiêu đề sự cố không được để trống'); return }
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  const s = f => setForm(p=>({...p,...f}))

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="wty-case-title"
    >
        <div className="wty-modal-header">
          <h3 id="wty-case-title">{isEdit ? 'Cập nhật case' : 'Tạo case bảo hành mới'}</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Mã case</label>
              <input value={form.case_no} onChange={e=>s({case_no:e.target.value})} placeholder="VD: BH-2026-001" />
            </div>
            <div className="wty-form-group">
              <label>Ngày báo cáo</label>
              <DateInput value={form.reported_date} onChange={e=>s({reported_date:e.target.value})} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tiêu đề / Nội dung sự cố *</label>
              <input className={err?'err':''} value={form.title}
                onChange={e=>s({title:e.target.value})}
                placeholder="VD: Hệ thống nguồn hoạt động bất thường sau cơn giông..." />
              {err && <span className="wty-form-err">{err}</span>}
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Mô tả chi tiết</label>
              <textarea rows={3} value={form.description} onChange={e=>s({description:e.target.value})}
                placeholder="Mô tả chi tiết tình trạng sự cố..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Người báo cáo</label>
              <input value={form.reported_by} onChange={e=>s({reported_by:e.target.value})} placeholder="Tên người báo cáo..." />
            </div>
            <div className="wty-form-group">
              <label>Mức độ ưu tiên</label>
              <select value={form.priority} onChange={e=>s({priority:e.target.value})}>
                {PRIORITIES.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="wty-form-group full">
            <label>Trạng thái ban đầu</label>
            <div className="status-pill-group">
              {CASE_STATUSES.map(st => (
                <div key={st} className={`status-pill-opt ${form.status===st?caseStatusModalCls(st):''}`}
                  onClick={() => s({status:st})}>
                  {st}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo case'}
          </button>
        </div>
    </Modal>
  )
}
