import { API } from '../../config/api'
import DateInput from './DateInput'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import RowActions from './ReceivableRowActions'
import { PayableSectionMobile } from './PayableMobile'
import { CURRENCIES, PAYMENT_METHODS, fmtVND, calcVND, isOverdue, tmpId } from './contractInPayableUtils'

// ── Lịch phải trả theo ĐKTT hợp đồng nhập ─────────────────────────────────────

export default function PayableSection({ rows, setRows, contractInId }) {
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
      }
      return updated
    }))

  const addRow = () => {
    const r = {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      description: '', payment_method: 'TT', currency_code: 'VND',
      amount: '', exchange_rate: 1, amount_vnd: 0, due_date: '', delay_reason: '',
    }
    setRows(prev => [...prev, r])
    return r._key
  }
  const isMobile = useIsMobile()

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      description: row.description, payment_method: row.payment_method,
      currency_code: row.currency_code, amount: row.amount,
      exchange_rate: row.exchange_rate, due_date: row.due_date,
      delay_reason: row.delay_reason,
    }
    try {
      const url    = row._isNew ? `${API}/contract-ins/${contractInId}/payables` : `${API}/payables/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key
        ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false }
        : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa khoản phải trả "${row.description || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/payables/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  const totalVND = rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Phải trả theo ĐKTT hợp đồng</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm khoản
        </button>
      </div>

      {isMobile ? (
        <PayableSectionMobile
          rows={rows} set={set} saveRow={saveRow} deleteRow={deleteRow} addRow={addRow}
          currencies={CURRENCIES} methods={PAYMENT_METHODS} calcVND={calcVND} fmtVND={fmtVND} isOverdue={isOverdue}
        />
      ) : (
      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-desc">Mô tả điều kiện thanh toán</th>
              <th style={{ minWidth:100 }}>Phương thức</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-date">Thời hạn trả</th>
              <th className="th-reason">Nguyên nhân trượt</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="10" className="recv-empty">Chưa có khoản phải trả nào. Nhấn <strong>Thêm khoản</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const overdue = isOverdue(row.due_date) && !row._isNew
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              return (
                <tr key={row._key} className={[
                  overdue ? 'row-overdue' : '',
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-desc">
                    <input type="text" value={row.description || ''}
                      placeholder="VD: 30% đặt cọc khi ký HĐ..."
                      onChange={e => set(row._key, 'description', e.target.value)} />
                  </td>
                  <td>
                    <select value={row.payment_method || 'TT'}
                      onChange={e => set(row._key, 'payment_method', e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="td-cur">
                    <select value={row.currency_code || 'VND'}
                      onChange={e => set(row._key, 'currency_code', e.target.value)}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : row.amount}
                      min="0" placeholder="0"
                      onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number"
                      value={row.currency_code === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={row.currency_code === 'VND'} min="0" placeholder="1"
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-date">
                    <DateInput value={row.due_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'due_date', e.target.value)} />
                    {overdue && <span className="overdue-tag">Quá hạn</span>}
                  </td>
                  <td className="td-reason">
                    <input type="text" value={row.delay_reason || ''}
                      placeholder={overdue ? 'Nhập nguyên nhân...' : ''}
                      className={overdue && !row.delay_reason && !row._isNew ? 'input-warn' : ''}
                      onChange={e => set(row._key, 'delay_reason', e.target.value)} />
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
                <td colSpan="6" className="totals-label">TỔNG PHẢI TRẢ</td>
                <td className="td-vnd">{fmtVND(totalVND)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
    </div>
  )
}
