import { useState } from 'react'

import { DELIVERY_STATUSES } from './deliveryUtils'

// ── Batch modal (add/edit) ────────────────────────────────────────────────────

export default function BatchModal({ batch, onSave, onClose }) {
  const isEdit = !!batch
  const [form, setForm] = useState({
    batch_name:   batch?.batch_name   || '',
    receive_date: batch?.receive_date?.slice(0,10) || '',
    warehouse:    batch?.warehouse    || '',
    status:       batch?.status       || 'Chờ nhận',
    note:         batch?.note         || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p=>({...p,...f}))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:12, width:520, maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding:'16px 24px 12px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>{isEdit ? 'Cập nhật đợt nhận hàng' : 'Thêm đợt nhận hàng'}</h3>
          <button onClick={onClose} style={{ width:30, height:30, border:'none', background:'#f3f4f6', borderRadius:6, cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Tên đợt nhận</label>
              <input type="text" value={form.batch_name} onChange={e=>s({batch_name:e.target.value})} placeholder="VD: Đợt 1, Đợt giao hàng tháng 3..." />
            </div>
            <div className="form-group">
              <label>Ngày nhận</label>
              <input type="date" value={form.receive_date} onChange={e=>s({receive_date:e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Kho nhận hàng</label>
            <input type="text" value={form.warehouse} onChange={e=>s({warehouse:e.target.value})} placeholder="VD: Kho Hà Nội, Kho TP.HCM..." />
          </div>
          <div className="form-group">
            <label>Trạng thái</label>
            <select value={form.status} onChange={e=>s({status:e.target.value})}>
              {DELIVERY_STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea rows="2" value={form.note} onChange={e=>s({note:e.target.value})} placeholder="Ghi chú đặc biệt về đợt nhận..." />
          </div>
        </div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#f3f4f6', color:'#374151', cursor:'pointer', fontSize:13, fontWeight:600 }}>Hủy</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo đợt nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}
