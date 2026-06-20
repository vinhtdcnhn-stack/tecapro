import { fmtCompact, fmtFull, groupByStatus, debtStatusBadge } from '../execUtils.js'
import { fmtMoney } from '../../accounting/reportUtils.js'

// Chi tiết thẻ "Tổng giá trị HĐ": cơ cấu theo trạng thái + bảng tất cả HĐ theo giá trị.
export default function PortfolioDetail({ contracts = [], byContract, onOpenContract }) {
  const groups = groupByStatus(contracts)
  const rows = [...(byContract?.rows || [])].sort(
    (a, b) => (parseFloat(b.value_vnd) || 0) - (parseFloat(a.value_vnd) || 0))

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        {groups.map(g => (
          <div key={g.status} className="exec-chip">
            <div className="exec-chip-top">
              <span className={`status-badge ${g.badge}`}>{g.label}</span>
              <strong>{g.count} HĐ</strong>
            </div>
            <div className="exec-chip-val" title={fmtFull(g.valueVnd)}>{fmtCompact(g.valueVnd)}</div>
          </div>
        ))}
      </div>

      <h3 className="exec-detail-h">Danh sách hợp đồng theo giá trị</h3>
      {rows.length === 0 ? <p className="dash-empty">Chưa có dữ liệu hợp đồng.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>STT</th><th>Số HĐ</th><th>Dự án</th><th>Chủ đầu tư</th>
                <th className="num">Giá trị (VNĐ)</th><th className="num">Đã thu</th><th className="num">Còn nợ</th><th>Công nợ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.contract_out_id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-info')}>
                  <td>{i + 1}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.project_name || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="num" title={fmtFull(r.value_vnd)}>{fmtMoney(r.value_vnd)}</td>
                  <td className="num">{fmtMoney(r.paid_vnd)}</td>
                  <td className="num">{fmtMoney(r.outstanding_vnd)}</td>
                  <td><span className={`status-badge ${debtStatusBadge(r.status)}`}>{r.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="exec-detail-note">Bấm vào một dòng để mở hợp đồng. Tổng {rows.length} hợp đồng.</p>
    </div>
  )
}
