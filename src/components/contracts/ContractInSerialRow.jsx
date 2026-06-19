import { SERIAL_STATUSES, fmtDate } from './warrantyUtils'

const INACTIVE = ['Đã thay thế', 'Ngừng sử dụng']

const statusColor = (s) =>
  s === 'Lỗi'         ? { bg:'#fef2f2', bd:'#fca5a5', fg:'#b91c1c' } :
  s === 'Đã thay thế' ? { bg:'#f3f4f6', bd:'#d1d5db', fg:'#6b7280' } :
  s === 'Ngừng sử dụng' ? { bg:'#f3f4f6', bd:'#d1d5db', fg:'#6b7280' } :
                        { bg:'#f0fdf4', bd:'#86efac', fg:'#15803d' }

const cell  = { padding:'7px 10px', borderBottom:'1px solid #f3f4f6', verticalAlign:'middle', fontSize:13 }
const input = { width:'100%', padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:5, fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }

export default function ContractInSerialRow({ row, idx, selected, onToggleSelect, val, dirty, setF, onSave, saving, parentOptions, onReplace, onDelete }) {
  const status = val(row, 'status') || 'Đang hoạt động'
  const sc = statusColor(status)
  const isDirty = dirty(row.id)
  const inactive = INACTIVE.includes(row.status)
  const locked = !!row.batch_locked   // serial thuộc đợt đã khóa → chỉ đọc

  return (
    <tr style={{ background: selected ? '#eff6ff' : isDirty ? '#fffbeb' : 'transparent', opacity: inactive ? 0.65 : 1 }}>
      <td style={{ ...cell, textAlign:'center' }}>
        <input type="checkbox" checked={selected} disabled={locked} onChange={() => onToggleSelect(row.id)} style={{ cursor: locked ? 'not-allowed' : 'pointer', accentColor:'#2563eb' }} />
      </td>
      <td style={{ ...cell, textAlign:'center', color:'#9ca3af', fontSize:12 }}>{idx + 1}</td>

      <td style={{ ...cell, fontWeight:500, color:'#111827' }}>
        {row.item_name}
        {row.unit && <span style={{ color:'#9ca3af', fontWeight:400 }}> · {row.unit}</span>}
      </td>

      <td style={cell}>
        <input style={input} value={val(row, 'serial_no')} disabled={locked} onChange={e => setF(row.id, 'serial_no', e.target.value)} />
      </td>

      <td style={{ ...cell, color:'#6b7280', fontSize:12, whiteSpace:'nowrap' }}>
        {locked && <span title="Đợt đã khóa">🔒 </span>}{row.batch_name || '—'}
        <div style={{ color:'#9ca3af', fontSize:11 }}>{fmtDate(row.receive_date)}</div>
      </td>

      <td style={cell}>
        <select
          value={status} disabled={locked}
          onChange={e => setF(row.id, 'status', e.target.value)}
          style={{ ...input, background:sc.bg, borderColor:sc.bd, color:sc.fg, fontWeight:600, cursor: locked ? 'not-allowed' : 'pointer' }}
        >
          {SERIAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      <td style={cell}>
        <select
          value={val(row, 'parent_serial_id') || ''} disabled={locked}
          onChange={e => setF(row.id, 'parent_serial_id', e.target.value)}
          style={{ ...input, cursor: locked ? 'not-allowed' : 'pointer' }}
        >
          <option value="">— Máy độc lập —</option>
          {parentOptions.filter(p => p.id !== row.id).map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </td>

      <td style={cell}>
        <input style={input} value={val(row, 'note')} disabled={locked} onChange={e => setF(row.id, 'note', e.target.value)} placeholder="—" />
      </td>

      <td style={{ ...cell, textAlign:'center', whiteSpace:'nowrap' }}>
        {locked ? (
          <span style={{ fontSize:11, color:'#92400e' }} title="Đợt đã khóa — mở khóa để sửa">🔒 Đã khóa</span>
        ) : (
          <div style={{ display:'inline-flex', gap:4 }}>
            {isDirty && (
              <button onClick={() => onSave(row)} disabled={saving} title="Lưu"
                style={{ padding:'3px 8px', background:'#16a34a', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                {saving ? '…' : 'Lưu'}
              </button>
            )}
            <button onClick={() => onReplace(row)} title="Thay thế serial"
              style={{ padding:'3px 8px', background:'#fef3c7', color:'#b45309', border:'1px solid #fde68a', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              ↻
            </button>
            <button onClick={() => onDelete(row)} title="Xóa"
              style={{ padding:'3px 8px', background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              Xóa
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
