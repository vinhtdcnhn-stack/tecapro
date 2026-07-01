import { useState } from 'react'
import { fmtNum, calcAmounts } from './boqUtils'
import { ROW_KIND, kindOf } from './boqTree'
import MobileEditSheet, { Field } from './MobileEditSheet'
import NumberInput from '../common/NumberInput'
import { auditRowAttrs } from '../common/rowAudit'

// Phiên bản mobile của Bảng giá phân cấp: danh sách thẻ theo cây (thụt lề + nhãn
// PHẦN/NHÓM), chạm để mở sheet sửa đúng dòng. Lá sửa đủ trường; zone/nhóm sửa tên +
// (nhóm: ĐVT/SL mô tả). Số tiền nhóm/zone là roll-up (read-only).
export default function BOQMobile({ items, rollup, currency, set, saveRow, deleteRow, addRow, addZone, addGroup, addChild, toggleMultiply, totals, showHs = true, showType = true, showPrice = true }) {
  const [editingKey, setEditingKey] = useState(null)
  const flat = items.map(it => it.r)
  const editing = flat.find(r => r._key === editingKey) || null
  const editKind = editing ? kindOf(editing) : ROW_KIND.LEAF

  const openAdd = () => setEditingKey(addRow())
  const onSave  = () => { if (editing) saveRow(editing); setEditingKey(null) }
  const onDel   = () => { if (editing) deleteRow(editing); setEditingKey(null) }

  const amt = editing ? calcAmounts(editing.quantity, editing.unit_price, editing.vat_rate, currency) : null

  return (
    <div className="boq-mobile">
      <div className="mcards">
        {items.map(({ r, idx, depth }) => {
          const kind = kindOf(r)
          const roll = rollup?.get(r._key)
          const after = kind === ROW_KIND.LEAF
            ? calcAmounts(r.quantity, r.unit_price, r.vat_rate, currency).after
            : (roll?.after || 0)
          return (
            <div
              key={r._key}
              {...auditRowAttrs('contract_out_boq', r.id)}
              className={`mcard mcard--${kind} ${r._dirty ? 'mcard--dirty' : ''}`}
              style={depth ? { marginLeft: depth * 14 } : undefined}
              onClick={() => setEditingKey(r._key)}
            >
              <div className="mcard-head">
                {r._dirty && <span className="mcard-dot" title="Chưa lưu" />}
                {kind !== ROW_KIND.LEAF && <span className={`boq-kind-badge boq-badge-${kind}`}>{kind === ROW_KIND.ZONE ? 'PHẦN' : 'Hệ thống'}</span>}
                <span className="mcard-title">{idx + 1}. {r.item_name || '(chưa đặt tên)'}</span>
                <span className="mcard-amount">{showPrice ? fmtNum(after, currency) : '•••'}</span>
              </div>
              {kind === ROW_KIND.LEAF ? (
                <div className="mcard-meta">
                  <span>SL: {r.quantity || 0} {r.unit || ''}</span>
                  <span>Đơn giá: {showPrice ? fmtNum(r.unit_price, currency) : '•••'}</span>
                  <span>VAT {r.vat_rate || 0}%</span>
                  {showType && <span>{r.item_type === 'di_thang' ? 'Đi thẳng' : 'Trong nước'}</span>}
                </div>
              ) : (
                <div className="mcard-meta mcard-subactions" onClick={e => e.stopPropagation()}>
                  <button className="mcard-subbtn" onClick={() => setEditingKey(addChild(r, 'group'))} disabled={!r.id}>+ Thêm hệ thống</button>
                  <button className="mcard-subbtn" onClick={() => setEditingKey(addChild(r, 'leaf'))} disabled={!r.id}>+ Dòng con</button>
                  {kind === ROW_KIND.GROUP && toggleMultiply && (
                    <button
                      className={`mcard-subbtn${r.multiply_qty ? ' mcard-subbtn--on' : ''}`}
                      onClick={() => toggleMultiply(r)}
                    >
                      {r.multiply_qty ? `✓ × SL (${r.quantity || 0})` : '× theo SL'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="mcard-addrow">
          <button className="mcard-add" onClick={openAdd}>+ Thêm dòng</button>
          <button className="mcard-add" onClick={() => setEditingKey(addZone())}>+ Thêm phần</button>
          <button className="mcard-add" onClick={() => setEditingKey(addGroup())}>+ Thêm hệ thống</button>
        </div>
      </div>

      <div className="mcards-total">
        <span>TỔNG SAU VAT</span>
        <span>{showPrice ? fmtNum(totals.after, currency) : '•••'}</span>
      </div>

      {editing && (
        <MobileEditSheet
          title={editing._isNew ? 'Thêm dòng' : 'Sửa dòng'}
          saving={editing._saving}
          onClose={() => setEditingKey(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label={editKind === ROW_KIND.ZONE ? 'Tên phần / phân khu' : editKind === ROW_KIND.GROUP ? 'Tên nhóm / hệ thống' : 'Danh mục hàng hóa'}>
            <input value={editing.item_name} placeholder="Nhập tên..."
              onChange={e => set(editing._key, 'item_name', e.target.value)} />
          </Field>

          {editKind === ROW_KIND.LEAF && showHs && (
            <Field label="HScode">
              <input value={editing.hs_code} placeholder="—"
                onChange={e => set(editing._key, 'hs_code', e.target.value)} />
            </Field>
          )}
          {editKind !== ROW_KIND.ZONE && (
            <Field label="Đơn vị tính">
              <input value={editing.unit} placeholder="Bộ"
                onChange={e => set(editing._key, 'unit', e.target.value)} />
            </Field>
          )}
          {editKind !== ROW_KIND.ZONE && (
            <Field label="Số lượng">
              <input type="number" min="0" value={editing.quantity} placeholder="0"
                onChange={e => set(editing._key, 'quantity', e.target.value)} />
            </Field>
          )}
          {editKind === ROW_KIND.LEAF && (
            <>
              <Field label="Đơn giá">
                <NumberInput value={editing.unit_price} placeholder="0"
                  onChange={v => set(editing._key, 'unit_price', v)} />
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
            </>
          )}
        </MobileEditSheet>
      )}
    </div>
  )
}
