import { useState } from 'react'

import { fmtDate, fmtDateInput, td } from './supplierWarrantyUtils'

// ── Warranty row ──────────────────────────────────────────────────────────────

export default function WarrantyRow({ idx, w, selected, onToggle, onFieldUpdate, onEdit, onDelete, expiryInfo }) {
  const [editField, setEditField] = useState(null) // 'start' | 'end'
  const [tempVal, setTempVal]     = useState('')
  const [showSerials, setShowSerials] = useState(false)

  const serials = Array.isArray(w.serials) ? w.serials : []

  function startEdit(field, currentVal) {
    setEditField(field)
    setTempVal(fmtDateInput(currentVal))
  }

  async function commitEdit(field) {
    const apiField = field === 'start' ? 'warranty_start' : 'warranty_end'
    await onFieldUpdate(apiField, tempVal || null)
    setEditField(null)
  }

  function renderDateCell(field, value) {
    if (editField === field) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="date" value={tempVal} onChange={e => setTempVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(field); if (e.key === 'Escape') setEditField(null) }}
            style={{ padding: '3px 6px', border: '1px solid #3b82f6', borderRadius: 4, fontSize: 12 }} />
          <button onClick={() => commitEdit(field)}
            style={{ padding: '2px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✓</button>
          <button onClick={() => setEditField(null)}
            style={{ padding: '2px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      )
    }
    return (
      <span
        onClick={() => startEdit(field, value)}
        title="Nhấn để sửa"
        style={{
          cursor: 'pointer', padding: '2px 8px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap',
          background: value ? '#f0fdf4' : '#f9fafb',
          color: value ? '#15803d' : '#9ca3af',
          fontWeight: value ? 600 : 400,
        }}
      >
        {value ? fmtDate(value) : 'Nhấn để nhập ✎'}
      </span>
    )
  }

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={td('center')}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td style={td('center', { color: '#9ca3af', fontSize: 12 })}>{idx + 1}</td>
      <td style={td('left', { fontWeight: 500 })}>{w.item_name}</td>
      <td style={td('center')}>
        {serials.length > 0 ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowSerials(!showSerials)}
              style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              {serials.length} serial {showSerials ? '▲' : '▼'}
            </button>
            {showSerials && (
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '10px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 200, maxWidth: 300, marginTop: 4,
              }}>
                {serials.map(s => (
                  <span key={s.id} style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                    {s.serial_no}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
        )}
      </td>
      <td style={td('left', { color: '#6b7280' })}>{w.warranty_period_text || '—'}</td>
      <td style={td()}>{renderDateCell('start', w.warranty_start)}</td>
      <td style={td()}>{renderDateCell('end', w.warranty_end)}</td>
      <td style={td('center')}>
        {expiryInfo
          ? <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: expiryInfo.bg, color: expiryInfo.color }}>{expiryInfo.label}</span>
          : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
        }
      </td>
      <td style={td('center')}>
        <button
          onClick={() => onFieldUpdate('has_guarantee', !w.has_guarantee)}
          style={{
            padding: '3px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: w.has_guarantee ? '#dcfce7' : '#f3f4f6',
            color: w.has_guarantee ? '#15803d' : '#9ca3af',
          }}
        >
          {w.has_guarantee ? 'Có' : 'Không'}
        </button>
      </td>
      <td style={td('left', { color: '#9ca3af', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
        {w.note || '—'}
      </td>
      <td style={td()}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={onEdit}
            style={{ padding: '3px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Sửa</button>
          <button onClick={onDelete}
            style={{ padding: '3px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Xóa</button>
        </div>
      </td>
    </tr>
  )
}
