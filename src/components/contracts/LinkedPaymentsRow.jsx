import { API } from '../../config/api'
import { fmtVND, fmtAmt, calcVND, tmpId, needsRate } from './receivableUtils'
import DateInput from './DateInput'
import RowActions from './ReceivableRowActions'

// Inline sub-row: payments linked to one schedule item
export default function LinkedPaymentsRow({ schedRow, payRows, setPayRows, contractId, colSpan }) {
  const linked = payRows.filter(p =>
    p._isNew ? p._schedKey === schedRow._key : String(p.schedule_id) === String(schedRow.id)
  )

  // So sánh trên GIÁ TRỊ GỐC (đồng tiền HĐ), không dựa vào giá trị quy đổi VNĐ.
  const cur         = schedRow.currency_code || 'VND'
  const unit        = cur === 'VND' ? 'đ' : cur
  const schedAmt    = parseFloat(schedRow.amount) || 0
  const receivedAmt = linked.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const diff        = schedAmt - receivedAmt
  const isExcess    = diff < 0

  const set = (key, field, val) =>
    setPayRows(prev => prev.map(p => {
      if (p._key !== key) return p
      const upd = { ...p, [field]: val, _dirty: true }
      if (field === 'amount' || field === 'exchange_rate') {
        upd.amount_vnd = calcVND(
          field === 'amount'         ? val : upd.amount,
          field === 'exchange_rate'  ? val : upd.exchange_rate,
          upd.currency_code
        )
      }
      return upd
    }))

  const addPayment = () => {
    if (schedRow._isNew) return
    setPayRows(prev => [...prev, {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      _schedKey: schedRow._key,
      schedule_id: schedRow.id,
      payment_date: new Date().toISOString().slice(0, 10),
      currency_code: schedRow.currency_code || 'VND',
      amount: '', exchange_rate: schedRow.exchange_rate || 1,
      amount_vnd: 0, note: '',
    }])
  }

  const savePayment = async (row) => {
    if (needsRate(row)) { alert(`Nhập tỷ giá cho ${row.currency_code}.`); return }
    setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: true } : p))
    const body = {
      payment_date: row.payment_date, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      amount_vnd: row.amount_vnd, note: row.note,
      schedule_id: row.schedule_id,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/receivable-payments` : `${API}/receivable-payments/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setPayRows(prev => prev.map(p => p._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : p))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: false } : p))
    }
  }

  const deletePayment = async (row) => {
    if (row._isNew) { setPayRows(prev => prev.filter(p => p._key !== row._key)); return }
    if (!confirm('Xóa đợt tiền về này?')) return
    try {
      await fetch(`${API}/receivable-payments/${row.id}`, { method: 'DELETE' })
      setPayRows(prev => prev.filter(p => p._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  return (
    <tr className="linked-payments-row">
      <td colSpan={colSpan} className="linked-payments-cell">
        <div className="linked-payments-inner">

          {/* Payments table */}
          {linked.length > 0 && (
            <table className="linked-pay-table">
              <thead>
                <tr>
                  <th className="lp-th-stt">#</th>
                  <th className="lp-th-date">Ngày nhận</th>
                  <th className="lp-th-num">Giá trị ({schedRow.currency_code || 'VND'})</th>
                  <th className="lp-th-vnd">Quy đổi VNĐ</th>
                  <th className="lp-th-note">Ghi chú</th>
                  <th className="lp-th-act"></th>
                </tr>
              </thead>
              <tbody>
                {linked.map((p, idx) => {
                  const vnd = calcVND(p.amount, p.exchange_rate, p.currency_code)
                  return (
                    <tr key={p._key} className={[p._dirty ? 'row-dirty' : '', p._isNew ? 'row-new' : ''].filter(Boolean).join(' ')}>
                      <td className="td-stt">
                        {p._dirty && <span className="dirty-dot" />}
                        <span>{idx + 1}</span>
                      </td>
                      <td className="td-date">
                        <DateInput value={p.payment_date?.slice(0, 10) || ''}
                          onChange={e => set(p._key, 'payment_date', e.target.value)} />
                      </td>
                      <td className="td-num">
                        <input type="number" value={p.amount === '' ? '' : p.amount} min="0" placeholder="0"
                          onChange={e => set(p._key, 'amount', e.target.value)} />
                      </td>
                      <td className="td-vnd computed">{fmtVND(vnd)}</td>
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

          {/* Footer: add button + comparison */}
          <div className="linked-payments-footer">
            <button
              className="recv-btn recv-btn-sm"
              onClick={addPayment}
              disabled={schedRow._isNew}
              title={schedRow._isNew ? 'Lưu khoản phải thu trước' : ''}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm đợt tiền về
            </button>

            <div className="linked-comparison">
              <span className="cmp-item">
                <span className="cmp-label">Phải thu:</span>
                <span className="cmp-val">{fmtAmt(schedAmt, cur)} {unit}</span>
              </span>
              <span className="cmp-sep">|</span>
              <span className="cmp-item">
                <span className="cmp-label">Đã thu:</span>
                <span className="cmp-val cmp-received">{fmtAmt(receivedAmt, cur)} {unit}</span>
              </span>
              <span className="cmp-sep">|</span>
              <span className={`cmp-item ${isExcess ? 'cmp-excess' : receivedAmt === 0 ? 'cmp-zero' : 'cmp-shortage'}`}>
                <span className="cmp-label">{isExcess ? 'Thừa:' : 'Còn thiếu:'}</span>
                <span className="cmp-val">{fmtAmt(Math.abs(diff), cur)} {unit}</span>
              </span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
