import { FIELD_TYPES, TABLE_COLUMN_TYPES, CURRENCIES } from '../approvalUtils'

// Bỏ dấu tiếng Việt + chuẩn hóa thành field_key (a-z0-9_).
function slugify(label) {
  return (label || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Trình sửa danh sách trường của form (controlled). Cha giữ state `fields`.
export default function FieldEditor({ fields, onChange }) {
  function update(i, patch) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function updateLabel(i, label) {
    // Tự sinh field_key từ nhãn nếu key đang trống hoặc do auto-sinh trước đó.
    const f = fields[i]
    const patch = { label }
    if (!f.field_key || f._autoKey) { patch.field_key = slugify(label); patch._autoKey = true }
    update(i, patch)
  }
  function addField() {
    onChange([...fields, { label: '', field_key: '', field_type: 'text', is_required: false, _autoKey: true }])
  }
  function removeField(i) { onChange(fields.filter((_, idx) => idx !== i)) }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="ab-section">
      <div className="ab-section-head">
        <h3>Các trường của đơn</h3>
        <button type="button" className="btn btn-sm" onClick={addField}>+ Thêm trường</button>
      </div>
      {fields.length === 0 && <p className="approval-empty">Chưa có trường nào.</p>}
      {fields.map((f, i) => (
        <div key={i} className="ab-row">
          <div className="ab-row-main">
            <input
              className="ab-input ab-grow"
              placeholder="Nhãn trường (vd: Lý do)"
              value={f.label}
              onChange={e => updateLabel(i, e.target.value)}
            />
            <input
              className="ab-input ab-key"
              placeholder="khóa"
              value={f.field_key}
              onChange={e => update(i, { field_key: e.target.value, _autoKey: false })}
            />
            <select
              className="ab-input"
              value={f.field_type}
              onChange={e => update(i, { field_type: e.target.value })}
            >
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="ab-check">
              <input
                type="checkbox"
                checked={!!f.is_required}
                onChange={e => update(i, { is_required: e.target.checked })}
              /> Bắt buộc
            </label>
            <div className="ab-row-actions">
              <button type="button" className="ab-icon" title="Lên" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ab-icon" title="Xuống" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="ab-icon ab-danger" title="Xóa" onClick={() => removeField(i)}>✕</button>
            </div>
          </div>
          {f.field_type === 'select' && (
            <input
              className="ab-input ab-grow ab-suboption"
              placeholder="Các lựa chọn, phân tách bằng dấu phẩy (vd: Có, Không, Tùy)"
              value={Array.isArray(f.options) ? f.options.join(', ') : (f.options || '')}
              onChange={e => update(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            />
          )}
          {f.field_type === 'money' && (
            <label className="ab-sublabel ab-suboption" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Loại tiền:
              <select className="ab-input" value={f.config?.currency || 'VND'}
                onChange={e => update(i, { config: { ...(f.config || {}), currency: e.target.value } })}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {f.field_type === 'table' && (
            <TableColumnsEditor
              columns={f.config?.columns || []}
              onChange={cols => update(i, { config: { ...(f.config || {}), columns: cols } })}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Định nghĩa các cột cho trường kiểu "Bảng".
function TableColumnsEditor({ columns, onChange }) {
  function update(i, patch) { onChange(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c))) }
  function updateLabel(i, label) {
    const c = columns[i]
    const patch = { label }
    if (!c.key || c._auto) { patch.key = slugify(label); patch._auto = true }
    update(i, patch)
  }
  function add() { onChange([...columns, { label: '', key: '', type: 'text', _auto: true }]) }
  function remove(i) { onChange(columns.filter((_, idx) => idx !== i)) }

  return (
    <div className="ab-cols ab-suboption">
      <div className="ab-cols-head">
        <span className="ab-sublabel">Các cột của bảng</span>
        <button type="button" className="btn btn-sm" onClick={add}>+ Thêm cột</button>
      </div>
      {columns.length === 0 && <span className="ar-note">Chưa có cột nào — thêm cột để người đề xuất nhập theo dòng.</span>}
      {columns.map((c, i) => (
        <div key={i} className="ab-col-row">
          <input className="ab-input ab-grow" placeholder="Tên cột (vd: Tên thiết bị)" value={c.label} onChange={e => updateLabel(i, e.target.value)} />
          <input className="ab-input ab-key" placeholder="khóa" value={c.key} onChange={e => update(i, { key: e.target.value, _auto: false })} />
          <select className="ab-input" value={c.type} onChange={e => update(i, { type: e.target.value })}>
            {TABLE_COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {c.type === 'money' && (
            <select className="ab-input" title="Loại tiền" value={c.currency || 'VND'} onChange={e => update(i, { currency: e.target.value })}>
              {CURRENCIES.map(cc => <option key={cc} value={cc}>{cc}</option>)}
            </select>
          )}
          <button type="button" className="ab-icon ab-danger" title="Xóa cột" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
    </div>
  )
}
