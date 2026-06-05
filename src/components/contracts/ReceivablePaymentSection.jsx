import { API } from '../../config/api'
import { fmtVND, calcVND, tmpId, needsRate } from './receivableUtils'
import RowActions from './ReceivableRowActions'

// ── Payment section ───────────────────────────────────────────────────────────

export default function PaymentSection({ rows, setRows, contractId, totalExpected, refCurrency, refExRate }) {
  const set = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: val, _dirty: true }
      if (field === 'amount' || field === 'exchange_rate' || field === 'currency_code') {
        const cur = field === 'currency_code' ? val : updated.currency_code
        const amt = field === 'amount'        ? val : updated.amount
        const rt  = field === 'exchange_rate' ? val : updated.exchange_rate
        updated.amount_vnd = calcVND(amt, rt, cur)
        if (cur === 'VND') updated.exchange_rate = 1
        // Auto-compute ratio
        if (totalExpected > 0) {
          updated.payment_ratio = parseFloat(((updated.amount_vnd / totalExpected) * 100).toFixed(2))
        }
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    payment_date: new Date().toISOString().slice(0, 10),
    currency_code: refCurrency || 'VND', amount: '', exchange_rate: refCurrency !== 'VND' ? (refExRate || '') : 1,
    amount_vnd: 0, payment_ratio: '', note: '',
  }])

  const saveRow = async (row) => {
    if (needsRate(row)) {
      alert(`Vui lòng nhập tỷ giá quy đổi VNĐ cho đồng tiền ${row.currency_code}.`)
      return
    }
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      payment_date: row.payment_date, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      payment_ratio: row.payment_ratio, note: row.note,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/receivable-payments` : `${API}/receivable-payments/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/receivable-payments/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalPaidVND = rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Tiền về thực tế</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm đợt
        </button>
      </div>

      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-date">Ngày thanh toán</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-ratio">Tỷ lệ TT (%)</th>
              <th className="th-note">Ghi chú</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="9" className="recv-empty">Chưa có đợt thanh toán nào. Nhấn <strong>Thêm đợt</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              return (
                <tr key={row._key} className={[
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-date">
                    <input type="date" value={row.payment_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'payment_date', e.target.value)} />
                  </td>
                  <td className="td-cur">
                    <span className="currency-badge">{row.currency_code || refCurrency || 'VND'}</span>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : row.amount} min="0"
                      placeholder="0" onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number" value={(row.currency_code || refCurrency) === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={(row.currency_code || refCurrency) === 'VND'} min="0"
                      placeholder={needsRate(row) ? 'Bắt buộc!' : '1'}
                      className={needsRate(row) ? 'input-warn' : ''}
                      title={needsRate(row) ? `Nhập tỷ giá VNĐ/${row.currency_code}` : ''}
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-ratio">
                    <div className="ratio-cell">
                      <input type="number" value={row.payment_ratio === '' ? '' : row.payment_ratio}
                        min="0" max="100" step="0.01" placeholder="—"
                        onChange={e => set(row._key, 'payment_ratio', e.target.value)} />
                      {row.payment_ratio > 0 && <span className="ratio-pct">%</span>}
                    </div>
                  </td>
                  <td className="td-note">
                    <input type="text" value={row.note || ''} placeholder="Ghi chú..."
                      onChange={e => set(row._key, 'note', e.target.value)} />
                  </td>
                  <td className="td-act">
                    <RowActions row={row} onSave={saveRow} onDelete={deleteRow} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.filter(r => !r._isNew).length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="5" className="totals-label">TỔNG ĐÃ THU</td>
                <td className="td-vnd">{fmtVND(totalPaidVND)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
