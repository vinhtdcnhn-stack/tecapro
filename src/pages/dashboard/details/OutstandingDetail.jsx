import { fmtFull, debtStatusBadge } from '../execUtils.js'
import { fmtMoney, fmtDate } from '../../accounting/reportUtils.js'

// Chi tiết thẻ "Công nợ phải thu": theo chủ đầu tư + danh sách HĐ còn nợ.
export default function OutstandingDetail({ byCustomer, byContract, onOpenContract }) {
  const custRows = [...(byCustomer?.rows || [])]
    .filter(r => (parseFloat(r.outstanding_vnd) || 0) > 0)
    .sort((a, b) => (parseFloat(b.outstanding_vnd) || 0) - (parseFloat(a.outstanding_vnd) || 0))
  const conRows = [...(byContract?.rows || [])]
    .filter(r => (parseFloat(r.outstanding_vnd) || 0) > 0)
    .sort((a, b) => (parseFloat(b.outstanding_vnd) || 0) - (parseFloat(a.outstanding_vnd) || 0))
  const t = byCustomer?.totals || {}

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip"><div className="exec-chip-lbl">Tổng công nợ</div>
          <div className="exec-chip-val" title={fmtFull(t.total_outstanding)}>{fmtMoney(t.total_outstanding)} đ</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Trong hạn</div>
          <div className="exec-chip-val" title={fmtFull(t.in_term)}>{fmtMoney(t.in_term)} đ</div></div>
        <div className="exec-chip exec-chip--danger"><div className="exec-chip-lbl">Quá hạn</div>
          <div className="exec-chip-val" title={fmtFull(t.overdue)}>{fmtMoney(t.overdue)} đ</div></div>
      </div>

      <h3 className="exec-detail-h">Công nợ theo chủ đầu tư</h3>
      {custRows.length === 0 ? <p className="dash-empty">Không có công nợ.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr><th>STT</th><th>Chủ đầu tư</th><th className="num">Số HĐ</th><th className="num">Còn nợ (VNĐ)</th></tr></thead>
            <tbody>
              {custRows.map((r, i) => (
                <tr key={r.customer_id}>
                  <td>{i + 1}</td><td>{r.customer_name || '—'}</td>
                  <td className="num">{r.total_contracts}</td>
                  <td className="num" title={fmtFull(r.outstanding_vnd)}>{fmtMoney(r.outstanding_vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="exec-detail-h">Hợp đồng còn nợ</h3>
      {conRows.length === 0 ? <p className="dash-empty">Không có hợp đồng còn nợ.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Số HĐ</th><th>Chủ đầu tư</th>
              <th className="num">Còn nợ</th><th>Hạn cuối</th><th className="num">Quá hạn</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {conRows.map((r, i) => (
                <tr key={r.contract_out_id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-debt')}>
                  <td>{i + 1}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="num" title={fmtFull(r.outstanding_vnd)}>{fmtMoney(r.outstanding_vnd)}</td>
                  <td>{fmtDate(r.last_due)}</td>
                  <td className="num">{r.days_overdue > 0 ? `${r.days_overdue} ngày` : '—'}</td>
                  <td><span className={`status-badge ${debtStatusBadge(r.status)}`}>{r.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
