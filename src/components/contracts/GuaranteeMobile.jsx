import { useState } from 'react'
import DateInput, { isoToDisplay } from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'
import NumberInput from '../common/NumberInput'
import { auditRowAttrs } from '../common/rowAudit'

// Giá trị hiển thị trong ô nhập: bỏ số 0 thập phân thừa; tiền VND làm tròn về số nguyên.
const dispAmount = (amt, currency) => {
  if (amt === '' || amt == null) return ''
  const n = parseFloat(amt)
  if (isNaN(n)) return ''
  return currency === 'VND' ? String(Math.round(n)) : String(n)
}

// Phiên bản mobile của Bảo lãnh: thẻ tóm tắt, chạm để mở sheet sửa đúng bản ghi.
// Tái dùng handler + helper của ContractGuaranteeTab (truyền qua props).
export default function GuaranteeMobile({
  rows, set, saveRow, deleteRow, addRow,
  types, statuses, contractCurrency, ratioOf, contractValue = 0, fmtVND, autoStatus, StatusPill, totalAmt, showAmounts = true,
  auditTable = 'contract_guarantee',
}) {
  const [editingKey, setEditingKey] = useState(null)
  const editing = rows.find(r => r._key === editingKey) || null

  const openAdd = () => setEditingKey(addRow())
  const onSave  = () => { if (editing) saveRow(editing); setEditingKey(null) }
  const onDel   = () => { if (editing) deleteRow(editing); setEditingKey(null) }
  // Tab nào truyền ratioOf thì có ô % so với giá trị HĐ (cả HĐ bán và HĐ nhập).
  const supportsPct = typeof ratioOf === 'function'
  const hdRatio = editing && supportsPct ? (editing.hd_ratio != null ? editing.hd_ratio : ratioOf(editing.amount)) : ''

  return (
    <div className="guar-mobile">
      <div className="mcards">
        {rows.map((row, i) => {
          const computed = autoStatus(row.expiry_date, row.status)
          return (
            <div key={row._key} {...auditRowAttrs(auditTable, row.id)} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setEditingKey(row._key)}>
              <div className="mcard-head">
                {row._dirty && <span className="mcard-dot" title="Chưa lưu" />}
                <span className="mcard-title">{i + 1}. {row.guarantee_type || '(chưa chọn loại)'}</span>
                <span className="mcard-amount">{showAmounts ? `${fmtVND(row.amount)} ${contractCurrency}` : '•••'}</span>
              </div>
              <div className="mcard-meta">
                <span>HSD: {isoToDisplay(row.expiry_date?.slice(0, 10)) || '—'}</span>
                {!row._isNew && <StatusPill status={computed} />}
              </div>
            </div>
          )
        })}
        <button className="mcard-add" onClick={openAdd}>+ Thêm bảo lãnh</button>
      </div>

      <div className="mcards-total">
        <span>TỔNG GIÁ TRỊ</span>
        <span>{showAmounts ? `${fmtVND(totalAmt)} ${contractCurrency}` : '•••'}</span>
      </div>

      {editing && (
        <MobileEditSheet
          title={editing._isNew ? 'Thêm bảo lãnh' : 'Sửa bảo lãnh'}
          saving={editing._saving}
          onClose={() => setEditingKey(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label="Loại bảo lãnh">
            <select value={editing.guarantee_type || ''} onChange={e => set(editing._key, 'guarantee_type', e.target.value)}>
              <option value="">-- Chọn loại --</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label={`Giá trị (${contractCurrency})`}>
            {showAmounts ? (
              <NumberInput placeholder="0"
                value={dispAmount(editing.amount, contractCurrency)}
                onChange={v => set(editing._key, 'amount', v)} />
            ) : <span className="recv-masked">•••</span>}
          </Field>
          {showAmounts && supportsPct && (
            <Field label="% so với giá trị HĐ">
              <input type="number" min="0" step="0.01"
                placeholder={contractValue > 0 ? '30' : '—'}
                disabled={!(contractValue > 0)}
                value={hdRatio === '' || hdRatio == null ? '' : hdRatio}
                onChange={e => set(editing._key, 'hd_ratio', e.target.value)} />
            </Field>
          )}
          <Field label="Ngày phát hành">
            <DateInput value={editing.issue_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'issue_date', e.target.value)} />
          </Field>
          <Field label="Ngày hết hạn">
            <DateInput value={editing.expiry_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'expiry_date', e.target.value)} />
          </Field>
          <Field label="Trạng thái">
            <select value={editing.status || 'Còn hiệu lực'} onChange={e => set(editing._key, 'status', e.target.value)}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Ghi chú">
            <input value={editing.note || ''} placeholder="Ghi chú..." onChange={e => set(editing._key, 'note', e.target.value)} />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
