import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput, { isoToDisplay } from './DateInput'
import useBienBanOptions from './useBienBanOptions'
import { addMonths } from './boqWarranty'

// ── Equipment Form Modal ──────────────────────────────────────────────────────

export default function EquipmentModal({ contractId, item, onSave, onClose }) {
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

  // Nguồn "BH từ": '' = nhập ngày trực tiếp, còn lại = id biên bản (lấy ngày thực tế của BB).
  const [fromSource, setFromSource] = useState(item?.warranty_bb_id != null ? String(item.warranty_bb_id) : '')
  // Cách nhập "BH đến": 'manual' = nhập ngày, 'months' = số tháng cộng từ BH từ.
  const [toMode, setToMode] = useState(item?.warranty_months != null ? 'months' : 'manual')
  // Số tháng bảo hành — tự cộng vào BH từ ra BH đến.
  const [months, setMonths] = useState(item?.warranty_months != null ? String(item.warranty_months) : '')
  // Danh sách biên bản (tab Tiến độ) để chọn làm mốc BH từ.
  const bbList = useBienBanOptions(contractId)

  const s = f => setForm(p=>({...p,...f}))

  // Đổi BH từ → nếu đang tính BH đến theo số tháng thì cập nhật lại ngày kết quả.
  function setFrom(iso) {
    setForm(p => ({
      ...p, warranty_from: iso,
      ...(toMode === 'months' && months ? { warranty_to: addMonths(iso, months) } : {}),
    }))
  }

  function handleFromSource(val) {
    setFromSource(val)
    if (val) {
      const bb = bbList.find(b => b.id === val)
      if (bb) setFrom(bb.date)
    }
  }

  function handleToMode(val) {
    setToMode(val)
    if (val === 'months' && months && form.warranty_from) s({ warranty_to: addMonths(form.warranty_from, months) })
  }

  function handleMonths(val) {
    setMonths(val)
    if (val && form.warranty_from) s({ warranty_to: addMonths(form.warranty_from, val) })
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setErr('Tên thiết bị không được để trống'); return }
    setSaving(true)
    // Lưu kèm nguồn tính BH để mở lại sửa còn đủ thông tin (biên bản + số tháng).
    await onSave({
      ...form,
      warranty_bb_id: fromSource || null,
      warranty_months: toMode === 'months' && months !== '' ? parseInt(months, 10) : null,
    }, isEdit)
    setSaving(false)
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="wty-equip-title"
    >
        <div className="wty-modal-header">
          <h3 id="wty-equip-title">{isEdit ? 'Cập nhật thiết bị' : 'Thêm thiết bị bàn giao'}</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
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
              <div className="wty-datecell">
                <select value={fromSource} onChange={e => handleFromSource(e.target.value)}>
                  <option value="">Nhập ngày</option>
                  {bbList.map(b => <option key={b.id} value={b.id}>BB: {b.label}</option>)}
                </select>
                {fromSource
                  ? <span className={`wty-dc-resolved${form.warranty_from ? '' : ' empty'}`}>→ {isoToDisplay(form.warranty_from) || '—'}</span>
                  : <DateInput value={form.warranty_from} onChange={e=>setFrom(e.target.value)} />}
              </div>
            </div>
            <div className="wty-form-group">
              <label>Bảo hành đến</label>
              <div className="wty-datecell">
                <select value={toMode} onChange={e => handleToMode(e.target.value)}>
                  <option value="manual">Nhập ngày</option>
                  <option value="months">Theo số tháng</option>
                </select>
                {toMode === 'months' ? (
                  <>
                    <div className="wty-dc-row">
                      <input className="wty-dc-days" type="number" min="0" step="1"
                        value={months} onChange={e=>handleMonths(e.target.value)} placeholder="0" />
                      <span className="wty-dc-unit">tháng kể từ BH từ</span>
                    </div>
                    <span className={`wty-dc-resolved${form.warranty_to ? '' : ' empty'}`}>→ {isoToDisplay(form.warranty_to) || '—'}</span>
                  </>
                ) : (
                  <DateInput value={form.warranty_to} onChange={e=>s({warranty_to:e.target.value})} />
                )}
              </div>
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
    </Modal>
  )
}
