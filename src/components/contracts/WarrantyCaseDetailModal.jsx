import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import DateInput from './DateInput'

import { API } from '../../config/api'
import {
  CASE_STATUSES, PRIORITIES, ACTIVITY_TYPES,
  fmtDT, caseStatusCls, caseStatusModalCls, priorityCls, activityIcon,
} from './warrantyUtils'
import CaseEquipmentLinker from './CaseEquipmentLinker'

// ── Case detail modal ─────────────────────────────────────────────────────────

export default function CaseDetailModal({ caseId, caseData, equipment, onUpdate, onClose }) {
  const [linkedEquip, setLinked] = useState([])
  const [activities, setActs]    = useState([])
  const [form, setForm]          = useState({ ...caseData })
  const [saving, setSaving]      = useState(false)
  const [actForm, setActForm]    = useState({ activity_type: 'Tiếp nhận', description: '', performed_by: '', performed_at: new Date().toISOString().slice(0,16) })

  useEffect(() => {
    fetch(`${API}/warranty-cases/${caseId}/equipment`).then(r=>r.json()).then(d => setLinked(Array.isArray(d)?d:[]))
    fetch(`${API}/warranty-cases/${caseId}/activities`).then(r=>r.json()).then(d => setActs(Array.isArray(d)?d:[]))
  }, [caseId])

  async function saveInfo() {
    setSaving(true)
    const res = await fetch(`${API}/warranty-cases/${caseId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setSaving(false); return }
    onUpdate(data)
    setSaving(false)
    alert('Đã lưu thông tin case.')
  }

  async function unlinkEquip(linkId) {
    if (!confirm('Xóa liên kết thiết bị này?')) return
    await fetch(`${API}/warranty-case-equipment/${linkId}`, { method: 'DELETE' })
    setLinked(prev => prev.filter(l => l.link_id !== linkId))
  }

  async function addActivity() {
    if (!actForm.description.trim()) { alert('Vui lòng nhập mô tả hoạt động'); return }
    const res = await fetch(`${API}/warranty-cases/${caseId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actForm),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setActs(prev => [data, ...prev])
    setActForm({ activity_type: 'Cập nhật tình trạng', description: '', performed_by: actForm.performed_by, performed_at: new Date().toISOString().slice(0,16) })
  }

  async function deleteActivity(id) {
    if (!confirm('Xóa nhật ký này?')) return
    await fetch(`${API}/warranty-activities/${id}`, { method: 'DELETE' })
    setActs(prev => prev.filter(a => a.id !== id))
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal wty-modal--wide"
      labelledBy="wty-detail-title"
    >
        <div className="wty-modal-header">
          <div>
            <h3 id="wty-detail-title">{form.case_no||'Case'} — {form.title}</h3>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <span className={`case-status ${caseStatusCls(form.status)}`}>{form.status}</span>
              <span className={`priority-badge ${priorityCls(form.priority)}`}>{form.priority}</span>
            </div>
          </div>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="wty-modal-body">
          {/* Section 1: Thông tin case */}
          <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:8 }}>Thông tin case</div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Mã case</label>
              <input value={form.case_no||''} onChange={e=>setForm(p=>({...p,case_no:e.target.value}))} />
            </div>
            <div className="wty-form-group">
              <label>Ngày báo</label>
              <DateInput value={form.reported_date?.slice(0,10)||''} onChange={e=>setForm(p=>({...p,reported_date:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tiêu đề / Nội dung sự cố</label>
              <input value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Mô tả chi tiết</label>
              <textarea rows={2} value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Người báo cáo</label>
              <input value={form.reported_by||''} onChange={e=>setForm(p=>({...p,reported_by:e.target.value}))} />
            </div>
            <div className="wty-form-group">
              <label>Ưu tiên</label>
              <select value={form.priority||'Bình thường'} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="wty-form-group full">
            <label>Trạng thái</label>
            <div className="status-pill-group">
              {CASE_STATUSES.map(s => (
                <div key={s} className={`status-pill-opt ${form.status===s ? caseStatusModalCls(s) : ''}`}
                  onClick={() => setForm(p => ({...p, status:s}))}>
                  {s}
                </div>
              ))}
            </div>
          </div>
          {form.status === 'Hoàn thành' && (
            <div className="wty-form-group">
              <label>Ngày hoàn thành</label>
              <DateInput value={form.resolved_date?.slice(0,10)||''} onChange={e=>setForm(p=>({...p,resolved_date:e.target.value}))} />
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="wty-btn wty-btn-primary" onClick={saveInfo} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>

          {/* Section 2: Thiết bị liên quan */}
          <div style={{ borderTop:'2px solid #f3f4f6', paddingTop:16 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
              Thiết bị liên quan ({linkedEquip.length})
            </div>
            <CaseEquipmentLinker
              caseId={caseId}
              equipment={equipment}
              onLinked={links => setLinked(prev => [...prev, ...links])}
            />
            {linkedEquip.length === 0 ? (
              <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Chưa có thiết bị nào được liên kết với case này.</div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {linkedEquip.map(l => (
                  <div key={l.link_id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
                    background:'#eff6ff', borderRadius:6, border:'1px solid #bfdbfe', fontSize:12 }}>
                    <strong>{l.name}</strong>
                    {l.serial_no && <span className="serial-chip">{l.serial_no}</span>}
                    <button onClick={() => unlinkEquip(l.link_id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:14, lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Nhật ký xử lý */}
          <div style={{ borderTop:'2px solid #f3f4f6', paddingTop:16 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
              Nhật ký xử lý ({activities.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'10px', background:'#f9fafb', borderRadius:8, marginBottom:12 }}>
              <div className="wty-form-row">
                <div className="wty-form-group">
                  <label>Loại hoạt động</label>
                  <select value={actForm.activity_type} onChange={e=>setActForm(p=>({...p,activity_type:e.target.value}))}>
                    {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="wty-form-group">
                  <label>Người thực hiện</label>
                  <input value={actForm.performed_by} onChange={e=>setActForm(p=>({...p,performed_by:e.target.value}))} placeholder="Tên người thực hiện..." />
                </div>
              </div>
              <div className="wty-form-row">
                <div className="wty-form-group">
                  <label>Thời gian thực hiện</label>
                  <input type="datetime-local" value={actForm.performed_at} onChange={e=>setActForm(p=>({...p,performed_at:e.target.value}))} />
                </div>
              </div>
              <div className="wty-form-group full">
                <label>Mô tả</label>
                <textarea rows={2} value={actForm.description} onChange={e=>setActForm(p=>({...p,description:e.target.value}))} placeholder="Mô tả hoạt động..." />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="wty-btn wty-btn-primary" onClick={addActivity}>+ Ghi nhật ký</button>
              </div>
            </div>
            <div className="activity-timeline">
              {activities.length === 0 ? (
                <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Chưa có nhật ký xử lý nào.</div>
              ) : activities.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot">{activityIcon(a.activity_type)}</div>
                  <div className="activity-content">
                    <div><span className="activity-type-tag">{a.activity_type||'Cập nhật'}</span>{a.description}</div>
                    <div className="activity-meta">
                      {a.performed_by && <strong>{a.performed_by}</strong>}
                      {a.performed_by && ' — '}
                      {fmtDT(a.performed_at)}
                    </div>
                  </div>
                  <button className="wty-act delete" onClick={() => deleteActivity(a.id)} title="Xóa">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Đóng</button>
        </div>
    </Modal>
  )
}
