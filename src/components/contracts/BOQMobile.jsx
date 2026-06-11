import { useState } from 'react'
import { fmtNum, calcAmounts } from './boqUtils'
import MobileEditSheet, { Field } from './MobileEditSheet'

// Phiên bản mobile của Bảng giá: danh sách thẻ tóm tắt, chạm để mở sheet sửa đúng dòng.
// Tái dùng nguyên các handler của ContractBOQTab (set / saveRow / deleteRow / addRow).
export default function BOQMobile({ rows, currency, set, saveRow, deleteRow, addRow, totals, showHs = true, showType = true }) {
  const [editingKey, setEditingKey] = useState(null)
  const editing = rows.find(r => r._key === editingKey) || null

  const openAdd = () => setEditingKey(addRow())
  const onSave  = () => { if (editing) saveRow(editing); setEditingKey(null) }
  const onDel   = () => { if (editing) deleteRow(editing); setEditingKey(null) }

  const amt = editing ? calcAmounts(editing.quantity, editing.unit_price, editing.vat_rate) : null

  return (
    <div className="boq-mobile">
      <div className="mcards">
        {rows.map((r, i) => {
          const { after } = calcAmounts(r.quantity, r.unit_price, r.vat_rate)
          return (
            <div
              key={r._key}
              className={`mcard ${r._dirty ? 'mcard--dirty' : ''}`}
              onClick={() => setEditingKey(r._key)}
            >
              <div className="mcard-head">
                {r._dirty && <span className="mcard-dot" title="Chưa lưu" />}
                <span className="mcard-title">{i + 1}. {r.item_name || '(chưa đặt tên)'}</span>
                <span className="mcard-amount">{fmtNum(after, currency)}</span>
              </div>
              <div className="mcard-meta">
                <span>SL: {r.quantity || 0} {r.unit || ''}</span>
                <span>Đơn giá: {fmtNum(r.unit_price, currency)}</span>
                <span>VAT {r.vat_rate || 0}%</span>
                {showType && <span>{r.item_type === 'di_thang' ? 'Đi thẳng' : 'Trong nước'}</span>}
              </div>
            </div>
          )
        })}

        <button className="mcard-add" onClick={openAdd}>+ Thêm dòng hàng</button>
      </div>

      <div className="mcards-total">
        <span>TỔNG SAU VAT</span>
        <span>{fmtNum(totals.after, currency)}</span>
      </div>

      {editing && (
        <MobileEditSheet
          title={editing._isNew ? 'Thêm dòng hàng' : 'Sửa dòng hàng'}
          saving={editing._saving}
          onClose={() => setEditingKey(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label="Danh mục hàng hóa">
            <input value={editing.item_name} placeholder="Nhập tên hàng hóa..."
              onChange={e => set(editing._key, 'item_name', e.target.value)} />
          </Field>
          {showHs && (
            <Field label="HScode">
              <input value={editing.hs_code} placeholder="—"
                onChange={e => set(editing._key, 'hs_code', e.target.value)} />
            </Field>
          )}
          <Field label="Đơn vị tính">
            <input value={editing.unit} placeholder="Bộ"
              onChange={e => set(editing._key, 'unit', e.target.value)} />
          </Field>
          <Field label="Số lượng">
            <input type="number" min="0" value={editing.quantity} placeholder="0"
              onChange={e => set(editing._key, 'quantity', e.target.value)} />
          </Field>
          <Field label="Đơn giá">
            <input type="number" min="0" value={editing.unit_price} placeholder="0"
              onChange={e => set(editing._key, 'unit_price', e.target.value)} />
          </Field>
          <Field label="VAT (%)">
            <input type="number" min="0" max="100" value={editing.vat_rate} placeholder="10"
              onChange={e => set(editing._key, 'vat_rate', e.target.value)} />
          </Field>
          <Field label="Thời hạn bảo hành">
            <input value={editing.warranty_period} placeholder="12 tháng"
              onChange={e => set(editing._key, 'warranty_period', e.target.value)} />
          </Field>
          {showType && (
            <Field label="Loại hàng">
              <select value={editing.item_type || 'trong_nuoc'}
                onChange={e => set(editing._key, 'item_type', e.target.value)}>
                <option value="trong_nuoc">Trong nước</option>
                <option value="di_thang">Đi thẳng</option>
              </select>
            </Field>
          )}

          <div className="mcard-meta">
            Trước VAT: <strong>{fmtNum(amt.before, currency)}</strong>
            {' · '}Sau VAT: <strong>{fmtNum(amt.after, currency)}</strong>
          </div>
        </MobileEditSheet>
      )}
    </div>
  )
}
