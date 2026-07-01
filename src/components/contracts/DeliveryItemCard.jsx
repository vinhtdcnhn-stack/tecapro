import { useState } from 'react'

import { fmtNum } from './deliveryUtils'
import MobileEditSheet, { Field } from './MobileEditSheet'
import DeliveryItemSerials from './DeliveryItemSerials'
import EditGuard from './EditGuard'
import { useCanEdit } from '../../context/ContractPermContext'
import { auditRowAttrs } from '../common/rowAudit'

// ── Thẻ một chủng loại hàng (mobile) ──────────────────────────────────────────
export default function DeliveryItemCard({
  idx, item, deliveryId, contractInId, locked = false, onDelete, onSaveFields, onSerialCountChange, onReload,
}) {
  const canEdit = useCanEdit() && !locked
  const [editing, setEditing] = useState(false)
  const [showSerials, setShowSerials] = useState(false)
  const [form, setForm] = useState({ received_quantity: item.received_quantity, note: item.note || '' })
  const [saving, setSaving] = useState(false)

  const serialCount = parseInt(item.serial_count) || 0
  const enough = parseFloat(item.received_quantity) >= parseFloat(item.ordered_quantity)

  function openEdit() {
    if (!canEdit) return
    setForm({ received_quantity: item.received_quantity, note: item.note || '' })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    await onSaveFields({ received_quantity: form.received_quantity, note: form.note })
    setSaving(false)
    setEditing(false)
  }

  return (
    <>
      <div className="mcard" {...auditRowAttrs('contract_in_delivery_item', item.id)} onClick={openEdit}>
        <div className="mcard-head">
          <span className="mcard-title">{idx + 1}. {item.item_name}</span>
          <span className="mcard-amount" style={{ color: enough ? '#15803d' : '#d97706' }}>
            {fmtNum(item.received_quantity)}/{fmtNum(item.ordered_quantity)}
          </span>
        </div>
        {item.note && <div className="mcard-meta"><span>{item.note}</span></div>}
        <div className="mcard-meta" onClick={e => e.stopPropagation()}>
          <button
            className="dlc-serial-chip"
            onClick={() => setShowSerials(true)}
            style={serialCount > 0
              ? { background:'#eff6ff', color:'#1d4ed8', borderColor:'#bfdbfe' }
              : { background:'#f9fafb', color:'#6b7280', borderColor:'#e5e7eb' }}
          >
            {serialCount > 0 ? `${serialCount} serial` : '+ Serial'} ›
          </button>
        </div>
      </div>

      {/* Sheet sửa SL nhận / ghi chú */}
      {editing && (
        <MobileEditSheet
          title={`Sửa: ${item.item_name}`}
          saving={saving}
          onClose={() => setEditing(false)}
          onSave={save}
          onDelete={() => { setEditing(false); onDelete() }}
        >
          <div className="msheet-readonly">
            ĐVT: <strong>{item.unit || '—'}</strong> · SL đặt: <strong>{fmtNum(item.ordered_quantity)}</strong>
          </div>
          <EditGuard>
            <Field label="SL nhận thực tế">
              <input type="number" min="0" value={form.received_quantity ?? ''}
                onChange={e => setForm(p => ({ ...p, received_quantity: e.target.value }))} />
            </Field>
            <Field label="Ghi chú">
              <input type="text" value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Ghi chú..." />
            </Field>
          </EditGuard>
        </MobileEditSheet>
      )}

      {/* Sheet quản lý serial */}
      {showSerials && (
        <MobileEditSheet title={`Serial: ${item.item_name}`} onClose={() => setShowSerials(false)}>
          <DeliveryItemSerials
            item={item}
            deliveryId={deliveryId}
            contractInId={contractInId}
            locked={locked}
            onSerialCountChange={onSerialCountChange}
            onReload={onReload}
          />
        </MobileEditSheet>
      )}
    </>
  )
}
