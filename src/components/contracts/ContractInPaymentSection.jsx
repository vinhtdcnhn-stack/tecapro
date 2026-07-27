import { API } from '../../config/api'
import DateInput from './DateInput'
import useIsMobile from './useIsMobile'
import RowActions from './ReceivableRowActions'
import { PaymentSectionMobile } from './PayableMobile'
import { CURRENCIES, fmtVND, calcVND, savePaymentRow } from './contractInPayableUtils'
import { auditRowAttrs } from '../common/rowAudit'

// ── Đợt thanh toán CHƯA GẮN khoản phải trả nào ────────────────────────────────
// Từ khi mỗi đợt thanh toán nằm trong một khoản phải trả (giống công nợ HĐ bán), mục này
// chỉ còn để "cứu" dữ liệu cũ hoặc đợt bị mất liên kết khi xóa khoản: chọn khoản ở cột
// "Gắn vào khoản" rồi lưu là đợt nhảy vào đúng khoản. Không có nút thêm mới ở đây.

export default function PaymentSection({
  rows, setRows, contractInId, totalExpected, reload, showAmounts = true, payables = [],
}) {
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
        if (totalExpected > 0) {
          updated.payment_ratio = parseFloat(((updated.amount_vnd / totalExpected) * 100).toFixed(2))
        }
      }
      return updated
    }))

  const isMobile = useIsMobile()

  const saveRow = (row) => savePaymentRow(row, contractInId, setRows, reload)

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/payments/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalPaidVND = rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Đợt thanh toán chưa gắn khoản</h4>
        <span className="recv-section-hint">
          Chọn khoản phải trả tương ứng ở cột <strong>Gắn vào khoản</strong> rồi lưu — đợt sẽ chuyển vào khoản đó ở bảng trên.
        </span>
      </div>

      {isMobile ? (
        <PaymentSectionMobile
          rows={rows} set={set} saveRow={saveRow} deleteRow={deleteRow}
          currencies={CURRENCIES} calcVND={calcVND} fmtVND={fmtVND} showAmounts={showAmounts}
          payables={payables}
        />
      ) : (
      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-date">Ngày thanh toán</th>
              <th className="th-desc">Gắn vào khoản</th>
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
            {rows.map((row, idx) => {
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              return (
                <tr key={row._key} {...auditRowAttrs('contract_in_payment', row.id)} className={[
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-date">
                    <DateInput value={row.payment_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'payment_date', e.target.value)} />
                  </td>
                  <td className="td-desc">
                    <select value={row.payable_id ?? ''}
                      onChange={e => set(row._key, 'payable_id', e.target.value === '' ? null : e.target.value)}>
                      <option value="">— Chưa gắn —</option>
                      {payables.filter(p => !p._isNew).map(p => (
                        <option key={p.id} value={p.id}>{p.description || `Khoản #${p.id}`}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td-cur">
                    <select value={row.currency_code || 'VND'}
                      onChange={e => set(row._key, 'currency_code', e.target.value)}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="td-num">
                    {showAmounts ? (
                      <input type="number" value={row.amount === '' ? '' : row.amount}
                        min="0" placeholder="0"
                        onChange={e => set(row._key, 'amount', e.target.value)} />
                    ) : <span className="recv-masked">•••</span>}
                  </td>
                  <td className="td-rate">
                    <input type="number"
                      value={row.currency_code === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={row.currency_code === 'VND'} min="0" placeholder="1"
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{showAmounts ? fmtVND(vnd) : '•••'}</td>
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
                <td colSpan="6" className="totals-label">TỔNG CHƯA GẮN KHOẢN</td>
                <td className="td-vnd">{showAmounts ? fmtVND(totalPaidVND) : '•••'}</td>
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
