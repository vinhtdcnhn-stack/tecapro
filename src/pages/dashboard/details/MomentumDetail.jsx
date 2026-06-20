import { fmtCompact, fmtFull, signedByMonth, signedThisYearVnd, signedThisYearCount } from '../execUtils.js'
import { fmtMoney } from '../../accounting/reportUtils.js'

// Chi tiết thẻ "Đà ký HĐ": biểu đồ cột (CSS thuần) giá trị HĐ ký theo 12 tháng gần nhất.
export default function MomentumDetail({ contracts = [] }) {
  const months = signedByMonth(contracts, 12)
  const max = Math.max(1, ...months.map(m => m.valueVnd))
  const yearVnd = signedThisYearVnd(contracts)
  const yearCount = signedThisYearCount(contracts)

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip"><div className="exec-chip-lbl">Giá trị HĐ ký năm nay</div>
          <div className="exec-chip-val" title={fmtFull(yearVnd)}>{fmtCompact(yearVnd)}</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Số HĐ ký năm nay</div>
          <div className="exec-chip-val">{yearCount}</div></div>
      </div>

      <h3 className="exec-detail-h">Giá trị hợp đồng ký theo tháng (12 tháng gần nhất)</h3>
      <div className="exec-bars">
        {months.map(m => (
          <div key={m.key} className="exec-bar-col" title={`${m.label}: ${fmtFull(m.valueVnd)} · ${m.count} HĐ`}>
            <div className="exec-bar-val">{m.valueVnd > 0 ? fmtCompact(m.valueVnd) : ''}</div>
            <div className="exec-bar-track">
              <div className="exec-bar-fill" style={{ height: `${(m.valueVnd / max) * 100}%` }} />
            </div>
            <div className="exec-bar-lbl">{m.label}</div>
          </div>
        ))}
      </div>

      <h3 className="exec-detail-h">Chi tiết theo tháng</h3>
      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead><tr><th>Tháng</th><th className="num">Số HĐ ký</th><th className="num">Giá trị (VNĐ)</th></tr></thead>
          <tbody>
            {[...months].reverse().map(m => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td className="num">{m.count}</td>
                <td className="num" title={fmtFull(m.valueVnd)}>{fmtMoney(m.valueVnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
