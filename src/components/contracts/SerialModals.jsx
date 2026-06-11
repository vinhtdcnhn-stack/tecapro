import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput from './DateInput'

// Modal dùng chung cho phần Quản lý Serial.

// ── Thêm 1 linh kiện (tự tạo loại nếu chưa có) ──────────────────────────────────
export function ComponentModal({ equipment, serials, onClose, onSave }) {
  const [f, setF] = useState({ name: '', brand: '', model: '', serial_no: '',
    warranty_from: '', warranty_to: '', parent_serial_id: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  async function submit() {
    if (!f.name.trim() || !f.serial_no.trim()) { alert('Nhập tên linh kiện và serial.'); return }
    setSaving(true)
    await onSave({ ...f, warranty_from: f.warranty_from || null, warranty_to: f.warranty_to || null,
      parent_serial_id: f.parent_serial_id || null })
    setSaving(false)
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="serial-comp-title"
    >
        <div className="wty-modal-header">
          <h3 id="serial-comp-title">Thêm linh kiện</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tên linh kiện *</label>
              <input list="eq-names" value={f.name} onChange={e => set('name', e.target.value)} placeholder="VD: Ổ cứng SSD 960GB" />
              <datalist id="eq-names">{equipment.map(eq => <option key={eq.id} value={eq.name} />)}</datalist>
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group"><label>Hãng</label>
              <input value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="VD: Samsung, Intel..." /></div>
            <div className="wty-form-group"><label>Model</label>
              <input value={f.model} onChange={e => set('model', e.target.value)} /></div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full"><label>Serial *</label>
              <input value={f.serial_no} onChange={e => set('serial_no', e.target.value)} /></div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group"><label>Bảo hành từ</label>
              <DateInput value={f.warranty_from} onChange={e => set('warranty_from', e.target.value)} /></div>
            <div className="wty-form-group"><label>Bảo hành đến</label>
              <DateInput value={f.warranty_to} onChange={e => set('warranty_to', e.target.value)} /></div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full"><label>Thuộc máy (tùy chọn)</label>
              <select value={f.parent_serial_id} onChange={e => set('parent_serial_id', e.target.value)}>
                <option value="">— Rời / chưa rõ —</option>
                {serials.map(o => <option key={o.id} value={o.id}>{o.eqName} – {o.serial_no}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={submit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Thêm'}
          </button>
        </div>
    </Modal>
  )
}

// ── Thay thế serial sau bảo hành ────────────────────────────────────────────────
// `serial` cần: { serial_no, eqName?, warranty_from?, warranty_to? }
// `endpoint`: URL đầy đủ để POST (vd .../serials/12/replace hoặc .../delivery-serials/3/replace)
// `showWarranty`: hiện ô nhập hạn BH (mặc định true; phía nhập = false vì BH lấy theo loại hàng).
// onDone(result) gọi khi thay thế xong (result = { old, new }).
export function ReplaceSerialModal({ serial, endpoint, showWarranty = true, onClose, onDone }) {
  const [f, setF] = useState({
    new_serial_no: '',
    warranty_from: (serial.warranty_from || '').slice(0, 10),
    warranty_to:   (serial.warranty_to   || '').slice(0, 10),
    replaced_at:   new Date().toISOString().slice(0, 10),
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  async function submit() {
    if (!f.new_serial_no.trim()) { alert('Nhập số serial mới.'); return }
    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_serial_no: f.new_serial_no.trim(),
          warranty_from: showWarranty ? (f.warranty_from || null) : null,
          warranty_to:   showWarranty ? (f.warranty_to || null) : null,
          replaced_at:   f.replaced_at || null,
          note:          f.note.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi thay thế serial')
      await onDone(data)
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="serial-replace-title"
    >
        <div className="wty-modal-header">
          <h3 id="serial-replace-title">Thay thế serial sau bảo hành</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-replace-old">
            Serial cũ: <strong>{serial.serial_no}</strong>
            {serial.eqName ? <span> — {serial.eqName}</span> : null}
            <div className="wty-replace-hint">Serial cũ sẽ chuyển sang trạng thái “Đã thay thế” (ngừng hoạt động) nhưng vẫn được giữ trong danh sách quản lý.</div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full"><label>Serial mới *</label>
              <input value={f.new_serial_no} onChange={e => set('new_serial_no', e.target.value)} placeholder="Nhập số serial của thiết bị thay thế" autoFocus /></div>
          </div>
          {showWarranty && (
            <div className="wty-form-row">
              <div className="wty-form-group"><label>Bảo hành từ</label>
                <DateInput value={f.warranty_from} onChange={e => set('warranty_from', e.target.value)} /></div>
              <div className="wty-form-group"><label>Bảo hành đến</label>
                <DateInput value={f.warranty_to} onChange={e => set('warranty_to', e.target.value)} /></div>
            </div>
          )}
          <div className="wty-form-row">
            <div className="wty-form-group"><label>Ngày thay thế</label>
              <DateInput value={f.replaced_at} onChange={e => set('replaced_at', e.target.value)} /></div>
            <div className="wty-form-group"><label>Ghi chú</label>
              <input value={f.note} onChange={e => set('note', e.target.value)} placeholder="VD: NCC đổi mới do lỗi nguồn" /></div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={submit} disabled={saving}>
            {saving ? 'Đang xử lý...' : 'Thay thế'}
          </button>
        </div>
    </Modal>
  )
}
