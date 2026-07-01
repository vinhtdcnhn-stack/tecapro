import { useState } from 'react'
import DateInput from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'
import { auditRowAttrs } from '../common/rowAudit'

const wtyColor = (cls) =>
  cls === 'wty-badge--expired'  ? { bg: '#fee2e2', fg: '#b91c1c' } :
  cls === 'wty-badge--expiring' ? { bg: '#fef3c7', fg: '#b45309' } :
  cls === 'wty-badge--active'   ? { bg: '#dcfce7', fg: '#15803d' } :
                                  { bg: '#f3f4f6', fg: '#6b7280' }

// Phiên bản mobile của Quản lý Serial (phía bán): thẻ tóm tắt + sheet sửa 1 serial.
// Tái dùng val/setF/save/del của WarrantySerialSubTab. Thêm linh kiện vẫn qua nút
// "Thêm linh kiện" ở toolbar (ComponentModal).
export default function SerialMobile({
  rows, allSerials, val, setF, save, saving, del, onReplace, statuses, warrantyStatus,
}) {
  const [editingId, setEditingId] = useState(null)
  const editing = rows.find(r => String(r.id) === String(editingId)) || null

  const parentOptions = editing
    ? allSerials.filter(s => String(s.id) !== String(editing.id)).map(s => ({ id: s.id, label: s.serial_no }))
    : []

  const onSave = () => { if (editing) save(editing); setEditingId(null) }
  const onDel  = () => { if (editing) del(editing); setEditingId(null) }
  const replace = () => { const r = editing; setEditingId(null); onReplace(r) }

  return (
    <div className="serial-mobile">
      <div className="mcards">
        {rows.length === 0 && <div className="mcard" style={{ cursor: 'default', color: '#9ca3af' }}>Chưa có serial nào khớp.</div>}
        {rows.map((row, i) => {
          const s = warrantyStatus(row.effTo)
          const c = wtyColor(s.cls)
          return (
            <div key={row.id} {...auditRowAttrs('equipment_serial', row.id)} className="mcard" onClick={() => setEditingId(row.id)}>
              <div className="mcard-head">
                <span className="mcard-title">{i + 1}. {row.eqName}</span>
                <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
              <div className="mcard-meta">
                <span><strong>SN:</strong> {row.serial_no}</span>
                {(row.brand || row.model) && <span>{[row.brand, row.model].filter(Boolean).join(' / ')}</span>}
                <span>{row.status || '—'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <MobileEditSheet
          title="Sửa serial"
          saving={!!saving[editing.id]}
          onClose={() => setEditingId(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label="Số serial">
            <input value={val(editing, 'serial_no')} onChange={e => setF(editing.id, 'serial_no', e.target.value)} />
          </Field>
          <div className="mcard-meta">
            Thiết bị: <strong>{editing.eqName}</strong>
            {(editing.brand || editing.model) && <> · {[editing.brand, editing.model].filter(Boolean).join(' / ')}</>}
          </div>
          <Field label="Tình trạng">
            <select value={val(editing, 'status') || 'Đang hoạt động'} onChange={e => setF(editing.id, 'status', e.target.value)}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Bảo hành từ">
            <DateInput value={(val(editing, 'warranty_from') || '').slice(0, 10)} onChange={e => setF(editing.id, 'warranty_from', e.target.value)} />
          </Field>
          <Field label="Bảo hành đến">
            <DateInput value={(val(editing, 'warranty_to') || '').slice(0, 10)} onChange={e => setF(editing.id, 'warranty_to', e.target.value)} />
          </Field>
          <Field label="Thuộc máy (linh kiện gắn vào)">
            <select value={val(editing, 'parent_serial_id') || ''} onChange={e => setF(editing.id, 'parent_serial_id', e.target.value)}>
              <option value="">— Máy độc lập —</option>
              {parentOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Ghi chú">
            <input value={val(editing, 'note')} placeholder="(tùy chọn)" onChange={e => setF(editing.id, 'note', e.target.value)} />
          </Field>

          <button className="mcard-add" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#b45309' }} onClick={replace}>
            🔄 Thay thế serial này
          </button>
        </MobileEditSheet>
      )}
    </div>
  )
}
