import { useState } from 'react'

import MobileEditSheet, { Field } from './MobileEditSheet'
import DeliveryItemCard from './DeliveryItemCard'
import EditGuard from './EditGuard'

// ── Danh sách hàng của đợt nhận (mobile): thẻ + sheet ─────────────────────────
export default function DeliveryItemsMobile({
  items, boqItems, deliveryId, contractInId, locked = false,
  onAddItem, onDeleteItem, onUpdateItemFields, onSerialCountChange, onReload,
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="mcards" style={{ marginBottom: 12 }}>
      {items.length === 0 && (
        <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
          Chưa có hàng hóa. Nhấn "+ Thêm hàng" để thêm.
        </div>
      )}

      {items.map((item, idx) => (
        <DeliveryItemCard
          key={item.id}
          idx={idx}
          item={item}
          deliveryId={deliveryId}
          contractInId={contractInId}
          locked={locked}
          onDelete={() => onDeleteItem(item)}
          onSaveFields={(fields) => onUpdateItemFields(item, fields)}
          onSerialCountChange={(delta) => onSerialCountChange(item.id, delta)}
          onReload={onReload}
        />
      ))}

      {locked ? (
        <div style={{ fontSize:12, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, padding:'8px 12px' }}>
          🔒 Đợt đã khóa — mở khóa để thêm/sửa hàng hóa.
        </div>
      ) : (
        <EditGuard>
          <button className="mcard-add" onClick={() => setAdding(true)}>+ Thêm hàng</button>
        </EditGuard>
      )}

      {adding && !locked && (
        <AddItemSheet
          boqItems={boqItems}
          existingNames={items.map(i => i.item_name)}
          onSave={async (form) => { await onAddItem(form); setAdding(false) }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

// ── Sheet thêm hàng (mobile) ──────────────────────────────────────────────────
function AddItemSheet({ boqItems, existingNames = [], onSave, onClose }) {
  const [form, setForm] = useState({
    boq_item_id: '', item_name: '', unit: '', ordered_quantity: '', received_quantity: '', note: '',
  })
  const [saving, setSaving] = useState(false)

  const norm = (s) => String(s || '').trim().toLowerCase()
  const usedNames = new Set(existingNames.map(norm))

  function handleBoqSelect(id) {
    const boq = boqItems.find(b => String(b.id) === String(id))
    if (boq) setForm(p => ({ ...p, boq_item_id: id, item_name: boq.item_name, unit: boq.unit, ordered_quantity: boq.quantity }))
    else setForm(p => ({ ...p, boq_item_id: '', item_name: '', unit: '' }))
  }

  async function submit() {
    if (!form.item_name.trim()) { alert('Vui lòng nhập tên hàng hóa'); return }
    if (usedNames.has(norm(form.item_name))) {
      alert(`Chủng loại "${form.item_name.trim()}" đã có trong đợt nhận này. Mỗi chủng loại chỉ thêm một dòng.`)
      return
    }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <MobileEditSheet title="Thêm hàng hóa vào đợt nhận" saving={saving} saveLabel="Thêm hàng"
      onClose={onClose} onSave={submit}>
      <Field label="Chọn từ BOQ">
        <select value={form.boq_item_id} onChange={e => handleBoqSelect(e.target.value)}>
          <option value="">-- Chọn hoặc nhập tự do --</option>
          {boqItems.filter(b => !usedNames.has(norm(b.item_name)))
            .map(b => <option key={b.id} value={b.id}>{b.item_name}</option>)}
        </select>
      </Field>
      <Field label="Tên hàng *">
        <input type="text" value={form.item_name} placeholder="Tên hàng..."
          onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
      </Field>
      <Field label="ĐVT">
        <input type="text" value={form.unit} placeholder="Bộ"
          onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
      </Field>
      <Field label="SL đặt">
        <input type="number" min="0" value={form.ordered_quantity} placeholder="0"
          onChange={e => setForm(p => ({ ...p, ordered_quantity: e.target.value }))} />
      </Field>
      <Field label="SL nhận thực tế">
        <input type="number" min="0" value={form.received_quantity} placeholder="0"
          onChange={e => setForm(p => ({ ...p, received_quantity: e.target.value }))} />
      </Field>
    </MobileEditSheet>
  )
}
