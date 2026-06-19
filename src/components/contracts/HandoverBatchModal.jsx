import { useState } from 'react'
import DateInput from './DateInput'

// Modal thêm/sửa đợt giao hàng (HĐ bán). Chỉ 3 trường: tên đợt, ngày giao, ghi chú.
export default function HandoverBatchModal({ batch, onSave, onClose }) {
  const isEdit = !!batch
  const [form, setForm] = useState({
    batch_name:    batch?.batch_name || '',
    delivery_date: batch?.delivery_date?.slice(0, 10) || '',
    note:          batch?.note || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:12, width:480, maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding:'16px 24px 12px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>{isEdit ? 'Cập nhật đợt giao hàng' : 'Thêm đợt giao hàng'}</h3>
          <button onClick={onClose} style={{ width:30, height:30, border:'none', background:'#f3f4f6', borderRadius:6, cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Tên đợt giao</label>
              <input type="text" value={form.batch_name} onChange={e => s({ batch_name: e.target.value })} placeholder="VD: Đợt 1, Đợt giao tháng 3..." />
            </div>
            <div className="form-group">
              <label>Ngày giao</label>
              <DateInput value={form.delivery_date} onChange={e => s({ delivery_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea rows="2" value={form.note} onChange={e => s({ note: e.target.value })} placeholder="Ghi chú về đợt giao hàng..." />
          </div>
        </div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#f3f4f6', color:'#374151', cursor:'pointer', fontSize:13, fontWeight:600 }}>Hủy</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo đợt giao'}
          </button>
        </div>
      </div>
    </div>
  )
}
