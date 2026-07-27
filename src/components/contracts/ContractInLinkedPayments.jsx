import { API } from '../../config/api'
import DateInput from './DateInput'
import RowActions from './ReceivableRowActions'
import { fmtVND, calcVND, tmpId, paymentsOf, savePaymentRow } from './contractInPayableUtils'
import { auditRowAttrs } from '../common/rowAudit'

// Hàng con lồng dưới mỗi KHOẢN PHẢI TRẢ: danh sách đợt thanh toán thực tế đã gắn vào
// khoản đó + so sánh Phải trả / Đã trả / Còn thiếu. Đối xứng với LinkedPaymentsRow của
// công nợ HĐ bán. Đợt thanh toán kế thừa đồng tiền & tỷ giá của khoản (không chọn lại).
export default function ContractInLinkedPayments({
  payableRow, payRows, setPayRows, contractInId, reloadPayments, colSpan, showAmounts = true,
}) {
  const linked = paymentsOf(payRows, payableRow)

  // So sánh trên GIÁ TRỊ GỐC (đồng tiền của khoản), không dựa vào quy đổi VNĐ.
  const cur       = payableRow.currency_code || 'VND'
  const unit      = cur === 'VND' ? 'đ' : cur
  const dueAmt    = parseFloat(payableRow.amount) || 0
  const paidAmt   = linked.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const diff      = dueAmt - paidAmt
  const isExcess  = diff < 0

  // Tỷ lệ TT của đợt = % trên giá trị của chính khoản phải trả (giữ cột payment_ratio có nghĩa).
  const ratioOf = (amt) => dueAmt > 0 ? parseFloat((((parseFloat(amt) || 0) / dueAmt) * 100).toFixed(2)) : null

  const set = (key, field, val) =>
    setPayRows(prev => prev.map(p => {
      if (p._key !== key) return p
      const upd = { ...p, [field]: val, _dirty: true }
      if (field === 'amount' || field === 'exchange_rate') {
        upd.amount_vnd = calcVND(
          field === 'amount'        ? val : upd.amount,
          field === 'exchange_rate' ? val : upd.exchange_rate,
          upd.currency_code,
        )
        if (field === 'amount') upd.payment_ratio = ratioOf(val)
      }
      return upd
    }))

  const addPayment = () => {
    if (payableRow._isNew) return
    setPayRows(prev => [...prev, {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      _payableKey: payableRow._key,
      payable_id: payableRow.id,
      payment_date: new Date().toISOString().slice(0, 10),
      currency_code: payableRow.currency_code || 'VND',
      amount: '', exchange_rate: payableRow.exchange_rate || 1,
      amount_vnd: 0, payment_ratio: null, note: '',
    }])
  }

  const savePayment = (row) => savePaymentRow(row, contractInId, setPayRows, reloadPayments)

  const deletePayment = async (row) => {
    if (row._isNew) { setPayRows(prev => prev.filter(p => p._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/payments/${row.id}`, { method: 'DELETE' })
      setPayRows(prev => prev.filter(p => p._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  return (
    <tr className="linked-payments-row">
      <td colSpan={colSpan} className="linked-payments-cell">
        <div className="linked-payments-inner">

          {linked.length > 0 && (
            <table className="linked-pay-table">
              <thead>
                <tr>
                  <th className="lp-th-stt">#</th>
                  <th className="lp-th-date">Ngày thanh toán</th>
                  <th className="lp-th-num">Giá trị ({cur})</th>
                  <th className="lp-th-vnd">Quy đổi VNĐ</th>
                  <th className="lp-th-note">Ghi chú</th>
                  <th className="lp-th-act"></th>
                </tr>
              </thead>
              <tbody>
                {linked.map((p, idx) => {
                  const vnd = calcVND(p.amount, p.exchange_rate, p.currency_code)
                  return (
                    <tr key={p._key} {...auditRowAttrs('contract_in_payment', p.id)}
                      className={[p._dirty ? 'row-dirty' : '', p._isNew ? 'row-new' : ''].filter(Boolean).join(' ')}>
                      <td className="td-stt">
                        {p._dirty && <span className="dirty-dot" />}
                        <span>{idx + 1}</span>
                      </td>
                      <td className="td-date">
                        <DateInput value={p.payment_date?.slice(0, 10) || ''}
                          onChange={e => set(p._key, 'payment_date', e.target.value)} />
                      </td>
                      <td className="td-num">
                        {showAmounts ? (
                          <input type="number" value={p.amount === '' ? '' : p.amount} min="0" placeholder="0"
                            onChange={e => set(p._key, 'amount', e.target.value)} />
                        ) : <span className="recv-masked">•••</span>}
                      </td>
                      <td className="td-vnd computed">{showAmounts ? fmtVND(vnd) : '•••'}</td>
                      <td className="td-note">
                        <input type="text" value={p.note || ''} placeholder="Ghi chú..."
                          onChange={e => set(p._key, 'note', e.target.value)} />
                      </td>
                      <td className="td-act">
                        <RowActions row={p} onSave={savePayment} onDelete={deletePayment} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <div className="linked-payments-footer">
            <button
              className="recv-btn recv-btn-sm"
              onClick={addPayment}
              disabled={payableRow._isNew}
              title={payableRow._isNew ? 'Lưu khoản phải trả trước' : ''}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm đợt thanh toán
            </button>

            <div className="linked-comparison">
              <span className="cmp-item">
                <span className="cmp-label">Phải trả:</span>
                <span className="cmp-val">{showAmounts ? `${fmtVND(dueAmt)} ${unit}` : '•••'}</span>
              </span>
              <span className="cmp-sep">|</span>
              <span className="cmp-item">
                <span className="cmp-label">Đã trả:</span>
                <span className="cmp-val cmp-received">{showAmounts ? `${fmtVND(paidAmt)} ${unit}` : '•••'}</span>
              </span>
              <span className="cmp-sep">|</span>
              <span className={`cmp-item ${isExcess ? 'cmp-excess' : paidAmt === 0 ? 'cmp-zero' : 'cmp-shortage'}`}>
                <span className="cmp-label">{isExcess ? 'Thừa:' : 'Còn thiếu:'}</span>
                <span className="cmp-val">{showAmounts ? `${fmtVND(Math.abs(diff))} ${unit}` : '•••'}</span>
              </span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
