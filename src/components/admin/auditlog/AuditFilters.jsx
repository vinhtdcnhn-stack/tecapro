import { tableLabel } from './auditLabels'

// Thanh bộ lọc nhật ký thay đổi. `value` là object filter; `onChange(patch)` cập nhật.
export default function AuditFilters({ value, onChange, options, onReset }) {
  const set = (k) => (e) => onChange({ [k]: e.target.value })
  const inp = { padding: '7px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
      <input
        style={{ ...inp, minWidth: 220 }}
        placeholder="🔍 Số HĐ / tên người thao tác"
        value={value.q || ''}
        onChange={set('q')}
      />

      <select style={inp} value={value.tableName || ''} onChange={set('tableName')}>
        <option value="">Mọi đối tượng</option>
        {(options.tables || []).map(t => (
          <option key={t} value={t}>{tableLabel(t)}</option>
        ))}
      </select>

      <select style={inp} value={value.actorId || ''} onChange={set('actorId')}>
        <option value="">Mọi người thao tác</option>
        {(options.actors || []).map(a => (
          <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
        ))}
      </select>

      <select style={inp} value={value.op || ''} onChange={set('op')}>
        <option value="">Mọi thao tác</option>
        <option value="I">Tạo mới</option>
        <option value="U">Sửa</option>
        <option value="D">Xóa</option>
      </select>

      <label style={{ fontSize: 13, color: '#555' }}>
        Từ <input type="date" style={inp} value={value.from || ''} onChange={set('from')} />
      </label>
      <label style={{ fontSize: 13, color: '#555' }}>
        đến <input type="date" style={inp} value={value.to || ''} onChange={set('to')} />
      </label>

      <button className="edit-btn" onClick={onReset}>Xóa lọc</button>
    </div>
  )
}
