import { useState } from 'react'
import { API } from '../../config/api'
import { fmtVND, fmtAmt, fmtDate, calcVND, receivableStatus, resolveDueDate, tmpId, needsRate, savePaymentRow } from './receivableUtils'
import DateInput from './DateInput'
import MobileEditSheet, { Field } from './MobileEditSheet'

// Phiên bản mobile của Công nợ: thẻ tóm tắt từng khoản phải thu, chạm để mở sheet
// sửa khoản + quản lý các đợt tiền về. Tái dùng handler của ScheduleSection.
export default function ReceivableMobile({
  rows, set, setDueBase, addRow, saveRow, deleteRow,
  payRows, setPayRows, contractId,
  refTotal, refCurrency, bbDateMap, baseOptions, contractDate,
  ratioOf, totalAmt, totalVND, unit,
}) {
  const [editingKey, setEditingKey] = useState(null)
  const editing = rows.find(r => r._key === editingKey) || null
  const dueCtx = { bbDateMap, contractDate }

  const openAdd = () => setEditingKey(addRow())

  const onSave = () => { if (editing) saveRow(editing); setEditingKey(null) }
  const onDel  = () => { if (editing) deleteRow(editing); setEditingKey(null) }

  // ── Payments của khoản đang sửa ──
  const linkedOf = (row) => payRows.filter(p =>
    p._isNew ? p._schedKey === row._key : String(p.schedule_id) === String(row.id))

  const setPay = (key, field, val) => setPayRows(prev => prev.map(p => {
    if (p._key !== key) return p
    const upd = { ...p, [field]: val, _dirty: true }
    if (field === 'amount' || field === 'exchange_rate')
      upd.amount_vnd = calcVND(field === 'amount' ? val : upd.amount, field === 'exchange_rate' ? val : upd.exchange_rate, upd.currency_code)
    return upd
  }))

  const addPayment = (schedRow) => setPayRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    _schedKey: schedRow._key, schedule_id: schedRow.id,
    payment_date: new Date().toISOString().slice(0, 10),
    currency_code: schedRow.currency_code || 'VND',
    amount: '', exchange_rate: schedRow.exchange_rate || 1, amount_vnd: 0, note: '',
  }])

  const deletePayment = async (row) => {
    if (row._isNew) { setPayRows(prev => prev.filter(p => p._key !== row._key)); return }
    if (!confirm('Xóa đợt tiền về này?')) return
    try {
      await fetch(`${API}/receivable-payments/${row.id}`, { method: 'DELETE' })
      setPayRows(prev => prev.filter(p => p._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const dueBaseVal = editing && (editing.due_base_anchor === 'contract' ? 'contract' : (editing.due_base_bb_type_id || ''))
  const dueComputed = dueBaseVal !== '' && dueBaseVal != null
  const editLinked = editing ? linkedOf(editing) : []

  return (
    <div className="recv-mobile">
      <div className="mcards">
        {rows.map((row, i) => {
          const linked = linkedOf(row)
          const due = resolveDueDate(row, dueCtx)
          const status = row._isNew ? null : receivableStatus(row, linked, due)
          const cur = row.currency_code || refCurrency || 'VND'
          return (
            <div key={row._key} className={`mcard ${row._dirty ? 'mcard--dirty' : ''}`} onClick={() => setEditingKey(row._key)}>
              <div className="mcard-head">
                {row._dirty && <span className="mcard-dot" title="Chưa lưu" />}
                <span className="mcard-title">{i + 1}. {row.description || '(chưa mô tả)'}</span>
                <span className="mcard-amount">{fmtAmt(row.amount, cur)} {cur === 'VND' ? 'đ' : cur}</span>
              </div>
              <div className="mcard-meta">
                <span>Hạn: {fmtDate(due)}</span>
                {status && <span className={`recv-status recv-status--${status.color}`}>{status.label}</span>}
                <span>Đã thu {linked.length} đợt</span>
              </div>
            </div>
          )
        })}
        <button className="mcard-add" onClick={openAdd}>+ Thêm khoản phải thu</button>
      </div>

      <div className="mcards-total">
        <span>TỔNG PHẢI THU</span>
        <span>{fmtAmt(totalAmt, refCurrency)} {unit} · {fmtVND(totalVND)} đ</span>
      </div>

      {editing && (
        <MobileEditSheet
          title={editing._isNew ? 'Thêm khoản phải thu' : 'Sửa khoản phải thu'}
          saving={editing._saving}
          onClose={() => setEditingKey(null)}
          onSave={onSave}
          onDelete={onDel}
        >
          <Field label="Mô tả điều kiện thanh toán">
            <input value={editing.description || ''} placeholder="VD: 30% đặt cọc khi ký HĐ..."
              onChange={e => set(editing._key, 'description', e.target.value)} />
          </Field>
          <Field label={`% theo HĐ${refTotal > 0 ? '' : ' (chưa có BOQ)'}`}>
            <input type="number" min="0" max="100" step="0.0001" disabled={refTotal === 0}
              value={editing.hd_ratio != null ? editing.hd_ratio : ratioOf(editing.amount)}
              placeholder={refTotal > 0 ? '30' : '—'}
              onChange={e => set(editing._key, 'hd_ratio', e.target.value)} />
          </Field>
          <Field label={`Giá trị (${editing.currency_code || refCurrency})`}>
            <input type="number" min="0" placeholder="0"
              value={editing.amount === '' ? '' : (typeof editing.amount === 'number' ? editing.amount.toFixed(2) : editing.amount)}
              onChange={e => set(editing._key, 'amount', e.target.value)} />
          </Field>
          {(editing.currency_code || refCurrency) !== 'VND' && (
            <Field label="Tỷ giá quy đổi VNĐ">
              <input type="number" min="0" value={editing.exchange_rate || ''}
                className={needsRate(editing) ? 'input-warn' : ''} placeholder="Bắt buộc"
                onChange={e => set(editing._key, 'exchange_rate', e.target.value)} />
            </Field>
          )}
          <div className="mcard-meta">Quy đổi: <strong>{fmtVND(calcVND(editing.amount, editing.exchange_rate, editing.currency_code))} đ</strong></div>

          <Field label="Thời hạn thu">
            <select value={dueBaseVal} onChange={e => setDueBase(editing._key, e.target.value)}>
              <option value="">Nhập ngày trực tiếp</option>
              <option value="contract">Theo ngày ký HĐ</option>
              {baseOptions.map(o => <option key={o.bb_type_id} value={o.bb_type_id}>{o.code}</option>)}
            </select>
          </Field>
          {dueComputed ? (
            <Field label="Số ngày kể từ mốc gốc">
              <input type="number" min="0" max="999" value={editing.due_offset_days ?? ''} placeholder="0"
                onChange={e => set(editing._key, 'due_offset_days', e.target.value.slice(0, 3))} />
              <span className="mcard-meta">→ {fmtDate(resolveDueDate(editing, dueCtx))}</span>
            </Field>
          ) : (
            <Field label="Ngày thu (dd/mm/yyyy)">
              <DateInput value={editing.due_date?.slice(0, 10) || ''}
                onChange={e => set(editing._key, 'due_date', e.target.value)} />
            </Field>
          )}
          <Field label="Nguyên nhân trượt hạn">
            <input value={editing.delay_reason || ''} placeholder="(nếu có)"
              onChange={e => set(editing._key, 'delay_reason', e.target.value)} />
          </Field>

          {/* ── Đợt tiền về ── */}
          {!editing._isNew && (
            <div className="recv-mobile-pays">
              <div className="msheet-field-label">Đợt tiền về ({editLinked.length})</div>
              {editLinked.map(p => (
                <div key={p._key} className={`recv-pay-block ${p._dirty ? 'mcard--dirty' : ''}`}>
                  <div className="recv-pay-grid">
                    <DateInput value={p.payment_date?.slice(0, 10) || ''}
                      onChange={e => setPay(p._key, 'payment_date', e.target.value)} />
                    <input type="number" min="0" placeholder="Giá trị"
                      value={p.amount === '' ? '' : p.amount}
                      onChange={e => setPay(p._key, 'amount', e.target.value)} />
                  </div>
                  <input type="text" placeholder="Ghi chú" value={p.note || ''}
                    onChange={e => setPay(p._key, 'note', e.target.value)} />
                  <div className="recv-pay-actions">
                    <button className="msheet-btn msheet-btn-danger" onClick={() => deletePayment(p)}>Xóa</button>
                    <button className="msheet-btn msheet-btn-primary" disabled={p._saving}
                      onClick={() => savePaymentRow(p, contractId, setPayRows)}>
                      {p._saving ? '…' : 'Lưu đợt'}
                    </button>
                  </div>
                </div>
              ))}
              <button className="mcard-add" onClick={() => addPayment(editing)}>+ Thêm đợt tiền về</button>
            </div>
          )}
        </MobileEditSheet>
      )}
    </div>
  )
}
