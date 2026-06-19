import { useState } from 'react'
import { fmtDate } from './warrantyUtils'
import MobileEditSheet, { Field } from './MobileEditSheet'

// Mobile cho Quản lý Serial (HĐ nhập): thẻ tóm tắt + sheet sửa 1 serial.
// Tái dùng val/setF/save/del của ContractInSerialTab.
export default function InSerialMobile({ rows, val, setF, save, saving, del, onReplace, statuses, parentOptions }) {
  const [editingId, setEditingId] = useState(null)
  const editing = rows.find(r => String(r.id) === String(editingId)) || null

  const onSave = () => { if (editing) save(editing); setEditingId(null) }
  const onDel  = () => { if (editing) del(editing); setEditingId(null) }
  const replace = () => { const r = editing; setEditingId(null); onReplace(r) }

  return (
    <div className="mcards">
      {rows.length === 0 && <div className="mcard" style={{ cursor: 'default', color: '#9ca3af' }}>Không có serial khớp.</div>}
      {rows.map((row, i) => {
        const locked = !!row.batch_locked
        return (
          <div key={row.id} className="mcard" style={locked ? { cursor: 'default' } : undefined}
            onClick={() => { if (!locked) setEditingId(row.id) }}>
            <div className="mcard-head">
              <span className="mcard-title">{i + 1}. {row.item_name}{row.unit ? ` · ${row.unit}` : ''}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{row.status || '—'}</span>
            </div>
            <div className="mcard-meta">
              <span><strong>SN:</strong> {row.serial_no}</span>
              <span>{locked && '🔒 '}{row.batch_name || '—'}{row.receive_date ? ` · ${fmtDate(row.receive_date)}` : ''}</span>
            </div>
          </div>
        )
      })}

      {editing && (
        <MobileEditSheet
          title="Sửa serial"
          saving={!!saving[editing.id]}
          onClose={() => setEditingId(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <div className="mcard-meta">
            Chủng loại: <strong>{editing.item_name}</strong>
            {editing.batch_name && <> · Đợt: {editing.batch_name}</>}
          </div>
          <Field label="Số serial">
            <input value={val(editing, 'serial_no')} onChange={e => setF(editing.id, 'serial_no', e.target.value)} />
          </Field>
          <Field label="Tình trạng">
            <select value={val(editing, 'status') || 'Đang hoạt động'} onChange={e => setF(editing.id, 'status', e.target.value)}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Thuộc máy (linh kiện gắn vào)">
            <select value={val(editing, 'parent_serial_id') || ''} onChange={e => setF(editing.id, 'parent_serial_id', e.target.value)}>
              <option value="">— Máy độc lập —</option>
              {parentOptions.filter(p => String(p.id) !== String(editing.id)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
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
