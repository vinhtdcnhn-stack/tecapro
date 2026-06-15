import { Field } from '../contracts/MobileEditSheet'
import DateInput from '../contracts/DateInput'
import NumberInput from '../common/NumberInput'
import { curLabel } from './approvalUtils'

// Render các trường của đơn theo định nghĩa form (chế độ nhập liệu).
// values: object keyed theo field_key. onChange(field_key, value).
// users: [{ id, full_name }] cho trường kiểu 'user'.
// Đính kèm: pendingFiles (File[]) + onPickFiles(File[]) + onRemoveFile(index) cho trường kiểu 'file'.
export default function DynamicFields({ fields, values, onChange, users = [], pendingFiles = [], onPickFiles, onRemoveFile }) {
  return (
    <>
      {fields.map(f => {
        const v = values[f.field_key]
        const label = f.is_required ? `${f.label} *` : f.label
        // Bảng: không bọc trong <label> (tránh click lung tung), render lưới riêng.
        if (f.field_type === 'table') {
          return (
            <div key={f.field_key} className="msheet-field ar-field-full">
              <span className="msheet-field-label">{label}</span>
              <TableField field={f} rows={Array.isArray(v) ? v : []} onChange={rows => onChange(f.field_key, rows)} />
            </div>
          )
        }
        return (
          <Field key={f.field_key} label={label}>
            {renderControl(f, v, val => onChange(f.field_key, val), users, { pendingFiles, onPickFiles, onRemoveFile })}
          </Field>
        )
      })}
    </>
  )
}

// Lưới nhập liệu nhiều dòng theo cột admin đã định nghĩa (field.config.columns).
function TableField({ field, rows, onChange }) {
  const cols = field.config?.columns || []
  const updateCell = (ri, key, val) => onChange(rows.map((r, idx) => (idx === ri ? { ...r, [key]: val } : r)))
  const addRow = () => onChange([...rows, {}])
  const removeRow = (ri) => onChange(rows.filter((_, idx) => idx !== ri))

  if (!cols.length) return <span className="ar-note">Bảng chưa được cấu hình cột.</span>
  return (
    <div className="ar-tablefield">
      <table className="ar-grid">
        <thead>
          <tr>{cols.map(c => <th key={c.key}>{c.label}{c.type === 'money' ? ` (${c.currency || 'VND'})` : ''}</th>)}<th aria-label="x" /></tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {cols.map(c => <td key={c.key}>{renderCell(c, row[c.key], val => updateCell(ri, c.key, val))}</td>)}
              <td><button type="button" className="ar-icon-del" title="Xóa dòng" onClick={() => removeRow(ri)}>✕</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="ar-note" style={{ textAlign: 'center' }}>Chưa có dòng nào.</td></tr>}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" onClick={addRow}>+ Thêm dòng</button>
    </div>
  )
}

function renderCell(c, val, set) {
  switch (c.type) {
    case 'number': return <input className="ab-input" type="number" value={val ?? ''} onChange={e => set(e.target.value)} />
    case 'money': return <NumberInput className="ab-input" value={val ?? ''} onChange={set} />
    case 'date': return <DateInput className="ab-input" value={val || ''} onChange={e => set(e.target.value)} />
    default: return <input className="ab-input" value={val || ''} onChange={e => set(e.target.value)} />
  }
}

function renderControl(f, v, set, users, fileCtx) {
  switch (f.field_type) {
    case 'textarea':
      return <textarea className="ab-input" rows={3} value={v || ''} onChange={e => set(e.target.value)} />
    case 'number':
      return <input className="ab-input" type="number" value={v ?? ''} onChange={e => set(e.target.value)} />
    case 'money':
      return (
        <div className="ar-money">
          <NumberInput className="ab-input" value={v ?? ''} onChange={set} />
          <span className="ar-cur">{curLabel(f.config?.currency)}</span>
        </div>
      )
    case 'date':
      return <DateInput className="ab-input" value={v || ''} onChange={e => set(e.target.value)} />
    case 'date_range': {
      const range = v && typeof v === 'object' ? v : { from: '', to: '' }
      return (
        <div className="ar-range">
          <DateInput className="ab-input" value={range.from || ''} onChange={e => set({ ...range, from: e.target.value })} />
          <span>→</span>
          <DateInput className="ab-input" value={range.to || ''} onChange={e => set({ ...range, to: e.target.value })} />
        </div>
      )
    }
    case 'select':
      return (
        <select className="ab-input" value={v || ''} onChange={e => set(e.target.value)}>
          <option value="">— Chọn —</option>
          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'checkbox':
      return (
        <label className="ab-check">
          <input type="checkbox" checked={!!v} onChange={e => set(e.target.checked)} /> Có
        </label>
      )
    case 'user':
      return (
        <select className="ab-input" value={v || ''} onChange={e => set(e.target.value)}>
          <option value="">— Chọn nhân viên —</option>
          {users.map(u => <option key={u.id} value={String(u.id)}>{u.full_name || u.email}</option>)}
        </select>
      )
    case 'file':
      return (
        <div>
          <label className="btn btn-sm ar-upload">
            + Chọn tệp
            <input type="file" hidden multiple
              onChange={e => { fileCtx?.onPickFiles?.([...e.target.files]); e.target.value = '' }} />
          </label>
          {(fileCtx?.pendingFiles || []).map((file, idx) => (
            <div key={idx} className="ar-att">
              <span>{file.name}</span>
              <button type="button" className="ar-icon-del" title="Bỏ" onClick={() => fileCtx?.onRemoveFile?.(idx)}>✕</button>
            </div>
          ))}
        </div>
      )
    default:
      return <input className="ab-input" value={v || ''} onChange={e => set(e.target.value)} />
  }
}
