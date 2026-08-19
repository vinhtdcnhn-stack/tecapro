import { useState } from 'react'
import { API } from '../../config/api'
import DateInput, { isoToDisplay } from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'
import { auditRowAttrs } from '../common/rowAudit'
import { tmpId, paymentsOf, payableStatus, savePaymentRow } from './contractInPayableUtils'

// Mobile cho tab Phải trả (HĐ nhập): thẻ từng khoản phải trả, chạm để mở sheet sửa khoản
// + quản lý các ĐỢT THANH TOÁN của chính khoản đó. Section "chưa gắn khoản" dùng
// PaymentSectionMobile bên dưới. Tái dùng set/saveRow/deleteRow/addRow của từng section.

export function PayableSectionMobile({
  rows, set, saveRow, deleteRow, addRow, currencies, methods, calcVND, fmtVND, showAmounts = true,
  payRows = [], setPayRows, contractInId, reloadPayments,
}) {
  const [key, setKey] = useState(null)
  const editing = rows.find(r => r._key === key) || null
  const openAdd = () => setKey(addRow())
  const onSave = () => { if (editing) saveRow(editing); setKey(null) }
  const onDel  = () => { if (editing) deleteRow(editing); setKey(null) }

  // ── Đợt thanh toán của khoản đang mở ──
  const setPay = (k, field, val) => setPayRows(prev => prev.map(p => {
    if (p._key !== k) return p
    const upd = { ...p, [field]: val, _dirty: true }
    if (field === 'amount' || field === 'exchange_rate')
      upd.amount_vnd = calcVND(field === 'amount' ? val : upd.amount, field === 'exchange_rate' ? val : upd.exchange_rate, upd.currency_code)
    return upd
  }))

  const addPayment = (payableRow) => setPayRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    _payableKey: payableRow._key, payable_id: payableRow.id,
    payment_date: new Date().toISOString().slice(0, 10),
    currency_code: payableRow.currency_code || 'VND',
    amount: '', exchange_rate: payableRow.exchange_rate || 1, amount_vnd: 0, note: '',
  }])

  const deletePayment = async (row) => {
    if (row._isNew) { setPayRows(prev => prev.filter(p => p._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/payments/${row.id}`, { method: 'DELETE' })
      setPayRows(prev => prev.filter(p => p._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const editLinked = editing ? paymentsOf(payRows, editing) : []

  return (
    <div className="mcards">
      {rows.map((row, i) => {
        const cur = row.currency_code || 'VND'
        const linked = paymentsOf(payRows, row)
        const status = row._isNew ? null : payableStatus(row, linked)
        return (
          <div key={row._key} {...auditRowAttrs('contract_in_payable', row.id)} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setKey(row._key)}>
            <div className="mcard-head">
              {row._dirty && <span className="mcard-dot" />}
              <span className="mcard-title">{i + 1}. {row.description || '(chưa mô tả)'}</span>
              <span className="mcard-amount">{showAmounts ? `${fmtVND(row.amount)} ${cur}` : '•••'}</span>
            </div>
            <div className="mcard-meta">
              <span>Hạn trả: {isoToDisplay(row.due_date?.slice(0, 10)) || '—'}</span>
              {status && <span className={`recv-status recv-status--${status.color}`}>{status.label}</span>}
              <span>Đã trả {linked.length} đợt</span>
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

          {/* ── Đợt thanh toán của khoản này ── */}
          {!editing._isNew && setPayRows && (
            <div className="recv-mobile-pays">
              <div className="msheet-field-label">Đợt thanh toán ({editLinked.length})</div>
              {editLinked.map(p => (
                <div key={p._key} className={`recv-pay-block ${p._dirty ? 'mcard--dirty' : ''}`}>
                  <div className="recv-pay-grid">
                    <DateInput value={p.payment_date?.slice(0, 10) || ''}
                      onChange={e => setPay(p._key, 'payment_date', e.target.value)} />
                    {showAmounts ? (
                      <input type="number" min="0" placeholder="Giá trị" value={p.amount === '' ? '' : p.amount}
                        onChange={e => setPay(p._key, 'amount', e.target.value)} />
                    ) : <span className="recv-masked">•••</span>}
                  </div>
                  <input type="text" placeholder="Ghi chú" value={p.note || ''}
                    onChange={e => setPay(p._key, 'note', e.target.value)} />
                  <div className="recv-pay-actions">
                    <button className="msheet-btn msheet-btn-danger" onClick={() => deletePayment(p)}>Xóa</button>
                    <button className="msheet-btn msheet-btn-primary" disabled={p._saving}
                      onClick={() => savePaymentRow(p, contractInId, setPayRows, reloadPayments)}>
                      {p._saving ? '…' : 'Lưu đợt'}
                    </button>
                  </div>
                </div>
              ))}
              <button className="mcard-add" onClick={() => addPayment(editing)}>+ Thêm đợt thanh toán</button>
            </div>
          )}
        </MobileEditSheet>
      )}
    </div>
  )
}

// Đợt thanh toán CHƯA gắn khoản (dữ liệu cũ): sửa + chọn khoản để gắn vào, không thêm mới.
export function PaymentSectionMobile({ rows, set, saveRow, deleteRow, currencies, calcVND, fmtVND, showAmounts = true, payables = [] }) {
  const [key, setKey] = useState(null)
  const editing = rows.find(r => r._key === key) || null
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

      {editing && (
        <MobileEditSheet title="Sửa đợt thanh toán"
          saving={editing._saving} onClose={() => setKey(null)} onSave={onSave} onDelete={onDel}>
          <Field label="Ngày thanh toán">
            <DateInput value={editing.payment_date?.slice(0, 10) || ''} onChange={e => set(editing._key, 'payment_date', e.target.value)} />
          </Field>
          <Field label="Gắn vào khoản phải trả">
            <select value={editing.payable_id ?? ''}
              onChange={e => set(editing._key, 'payable_id', e.target.value === '' ? null : e.target.value)}>
              <option value="">— Chưa gắn —</option>
              {payables.filter(p => !p._isNew).map(p => (
                <option key={p.id} value={p.id}>{p.description || `Khoản #${p.id}`}</option>
              ))}
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
          <Field label="Ghi chú">
            <input value={editing.note || ''} placeholder="(tùy chọn)" onChange={e => set(editing._key, 'note', e.target.value)} />
          </Field>
        </MobileEditSheet>
      )}
    </div>
  )
}
