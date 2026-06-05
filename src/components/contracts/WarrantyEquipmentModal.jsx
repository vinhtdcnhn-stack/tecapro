import { useState } from 'react'

// ── Equipment Form Modal ──────────────────────────────────────────────────────

export default function EquipmentModal({ item, onSave, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name||'', brand: item?.brand||'', model: item?.model||'',
    quantity: item?.quantity||1, location: item?.location||'',
    warranty_from: item?.warranty_from?.slice(0,10)||'',
    warranty_to: item?.warranty_to?.slice(0,10)||'',
    has_serial: item?.has_serial||false, note: item?.note||'',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleSubmit() {
    if (!form.name.trim()) { setErr('Tên thiết bị không được để trống'); return }
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  const s = f => setForm(p=>({...p,...f}))

  return (
    <div className="wty-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="wty-modal">
        <div className="wty-modal-header">
          <h3>{isEdit ? 'Cập nhật thiết bị' : 'Thêm thiết bị bàn giao'}</h3>
          <button className="wty-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tên thiết bị *</label>
              <input className={err?'err':''} value={form.name} onChange={e=>s({name:e.target.value})} placeholder="VD: Rectifier, UPS, Pin Lithium..." />
              {err && <span className="wty-form-err">{err}</span>}
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Hãng sản xuất</label>
              <input value={form.brand} onChange={e=>s({brand:e.target.value})} placeholder="VD: Megmeet, ABB..." />
            </div>
            <div className="wty-form-group">
              <label>Model</label>
              <input value={form.model} onChange={e=>s({model:e.target.value})} placeholder="VD: R483000G1..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Số lượng</label>
              <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>s({quantity:e.target.value})} />
            </div>
            <div className="wty-form-group">
              <label>Vị trí lắp đặt</label>
              <input value={form.location} onChange={e=>s({location:e.target.value})} placeholder="VD: Tầng 3, Rack A..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Bảo hành từ</label>
              <input type="date" value={form.warranty_from} onChange={e=>s({warranty_from:e.target.value})} />
            </div>
            <div className="wty-form-group">
              <label>Bảo hành đến</label>
              <input type="date" value={form.warranty_to} onChange={e=>s({warranty_to:e.target.value})} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Có serial?</label>
              <select value={form.has_serial?'1':'0'} onChange={e=>s({has_serial:e.target.value==='1'})}>
                <option value="1">Có — quản lý theo serial</option>
                <option value="0">Không — chỉ quản lý số lượng</option>
              </select>
            </div>
            <div className="wty-form-group">
              <label>Ghi chú</label>
              <input value={form.note} onChange={e=>s({note:e.target.value})} placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm thiết bị'}
          </button>
        </div>
      </div>
    </div>
  )
}
