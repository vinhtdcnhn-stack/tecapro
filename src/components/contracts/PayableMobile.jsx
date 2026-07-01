import { useState } from 'react'
import DateInput, { isoToDisplay } from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'
import { auditRowAttrs } from '../common/rowAudit'

// Mobile cho tab Phải trả (HĐ nhập). Hai section: khoản phải trả + đợt thanh toán.
// Tái dùng set/saveRow/deleteRow/addRow của từng section (truyền qua props).

export function PayableSectionMobile({ rows, set, saveRow, deleteRow, addRow, currencies, methods, calcVND, fmtVND, isOverdue, showAmounts = true }) {
  const [key, setKey] = useState(null)
  const editing = rows.find(r => r._key === key) || null
  const openAdd = () => setKey(addRow())
  const onSave = () => { if (editing) saveRow(editing); setKey(null) }
  const onDel  = () => { if (editing) deleteRow(editing); setKey(null) }

  return (
    <div className="mcards">
      {rows.map((row, i) => {
        const cur = row.currency_code || 'VND'
        const overdue = isOverdue(row.due_date) && !row._isNew
        return (
          <div key={row._key} {...auditRowAttrs('contract_in_payable', row.id)} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setKey(row._key)}>
            <div className="mcard-head">
              {row._dirty && <span className="mcard-dot" />}
              <span className="mcard-title">{i + 1}. {row.description || '(chưa mô tả)'}</span>
              <span className="mcard-amount">{showAmounts ? `${fmtVND(row.amount)} ${cur}` : '•••'}</span>
            </div>
            <div className="mcard-meta">
              <span>Hạn trả: {isoToDisplay(row.due_date?.slice(0, 10)) || '—'}</span>
              {overdue && <span style={{ color: '#b91c1c', fontWeight: 700 }}>Quá hạn</span>}
            </div>
          </div>
        )
      })}
      <button className="mcard-add" onClick={openAdd}>+ Thêm khoản phải trả</button>

      {editing && (
        <MobileEditSheet title={editing._isNew ? 'Thêm khoản phải trả' : 'Sửa khoản phải trả'}
          saving={editing._saving} onClose={() => setKey(null)} onSave={onSave} onDelete={onDel}>
          <Field label="Mô tả điều kiện thanh toán">
            <input value={editing.description || ''} placeholder="VD: 30% tạm ứng..." onChange={e => set(editing._key, 'description', e.target.value)} />
          </Field>
          <Field label="Phương thức">
            <select value={editing.payment_method || 'TT'} onChange={e => set(editing._key, 'payment_method', e.target.value)}>
              {methods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Đồng tiền">
            <select value={editing.currency_code || 'VND'} onChange={e => set(editing._key, 'currency_code', e.target.value)}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Giá trị">
            {showAmounts ? (
              <input type="number" min="0" placeholder="0" value={editing.amount === '' ? '' : editing.amount} onChange={e => set(editing._key, 'amount', e.target.value)} />
            ) : <span className="recv-masked">•••</span>}
          </Field>
          {(editing.currency_code || 'VND') !== 'VND' && (
            <Field label="Tỷ giá quy đổi VNĐ">
              <input type="number" min="0" value={editing.exchange_rate || ''} onChange={e => set(editing._key, 'exchange_rate', e.target.value)} />
            </Field>
          )}
          <div className="mcard-meta">Quy đổi: <strong>{showAmounts ? `${fmtVND(calcVND(editing.amount, editing.exchange_rate, editing.currency_code))} đ` : '•••'}</strong></div>
          <Field label="Thời hạn trả">
            <DateInput value={editing.due_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'due_date', e.target.value)} />
          </Field>
          <Field label="Nguyên nhân trượt hạn">
            <input value={editing.delay_reason || ''} placeholder="(nếu có)" onChange={e => set(editing._key, 'delay_reason', e.target.value)} />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}

export function PaymentSectionMobile({ rows, set, saveRow, deleteRow, addRow, currencies, calcVND, fmtVND, showAmounts = true }) {
  const [key, setKey] = useState(null)
  const editing = rows.find(r => r._key === key) || null
  const openAdd = () => setKey(addRow())
  const onSave = () => { if (editing) saveRow(editing); setKey(null) }
  const onDel  = () => { if (editing) deleteRow(editing); setKey(null) }

  return (
    <div className="mcards">
      {rows.map((row, i) => {
        const cur = row.currency_code || 'VND'
        return (
          <div key={row._key} {...auditRowAttrs('contract_in_payment', row.id)} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setKey(row._key)}>
            <div className="mcard-head">
              {row._dirty && <span className="mcard-dot" />}
              <span className="mcard-title">{i + 1}. {isoToDisplay(row.payment_date?.slice(0, 10)) || '(chưa có ngày)'}</span>
              <span className="mcard-amount">{showAmounts ? `${fmtVND(row.amount)} ${cur}` : '•••'}</span>
            </div>
            {row.note && <div className="mcard-meta"><span>{row.note}</span></div>}
          </div>
        )
      })}
      <button className="mcard-add" onClick={openAdd}>+ Thêm đợt thanh toán</button>

      {editing && (
        <MobileEditSheet title={editing._isNew ? 'Thêm đợt thanh toán' : 'Sửa đợt thanh toán'}
          saving={editing._saving} onClose={() => setKey(null)} onSave={onSave} onDelete={onDel}>
          <Field label="Ngày thanh toán">
            <DateInput value={editing.payment_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'payment_date', e.target.value)} />
          </Field>
          <Field label="Đồng tiền">
            <select value={editing.currency_code || 'VND'} onChange={e => set(editing._key, 'currency_code', e.target.value)}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Giá trị">
            {showAmounts ? (
              <input type="number" min="0" placeholder="0" value={editing.amount === '' ? '' : editing.amount} onChange={e => set(editing._key, 'amount', e.target.value)} />
            ) : <span className="recv-masked">•••</span>}
          </Field>
          {(editing.currency_code || 'VND') !== 'VND' && (
            <Field label="Tỷ giá quy đổi VNĐ">
              <input type="number" min="0" value={editing.exchange_rate || ''} onChange={e => set(editing._key, 'exchange_rate', e.target.value)} />
            </Field>
          )}
          <div className="mcard-meta">Quy đổi: <strong>{showAmounts ? `${fmtVND(calcVND(editing.amount, editing.exchange_rate, editing.currency_code))} đ` : '•••'}</strong></div>
          <Field label="Ghi chú">
            <input value={editing.note || ''} placeholder="(tùy chọn)" onChange={e => set(editing._key, 'note', e.target.value)} />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
