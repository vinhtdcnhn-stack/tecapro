import { fmtFull } from '../execUtils.js'
import { fmtMoney, fmtDate } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'

// Text dán chat: giá trị đã xuất hóa đơn theo hợp đồng.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.project_name, r.customer_name].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Giá trị HĐ: ${fmtMoney(r.value_vnd)} đ, `
    + `Đã xuất HĐ: ${fmtMoney(r.invoiced_vnd)} đ, Ngày ký: ${fmtDate(r.contract_date)}`
}

// Chi tiết thẻ "Doanh thu xuất HĐ {năm}": tổng + đã xuất hóa đơn theo từng hợp đồng.
export default function RevenueDetail({ cashflow, byContract, onOpenContract }) {
  const rows = [...(byContract?.rows || [])]
    .filter(r => (parseFloat(r.invoiced_vnd) || 0) > 0)
    .sort((a, b) => (parseFloat(b.invoiced_vnd) || 0) - (parseFloat(a.invoiced_vnd) || 0))
  const year = cashflow?.year || new Date().getFullYear()
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.contract_no || r.project_name || 'Hợp đồng')

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip"><div className="exec-chip-lbl">Doanh thu xuất HĐ {year}</div>
          <div className="exec-chip-val" title={fmtFull(cashflow?.revenue_ytd)}>{fmtMoney(cashflow?.revenue_ytd)} đ</div></div>
      </div>

      <h3 className="exec-detail-h">Giá trị đã xuất hóa đơn theo hợp đồng (lũy kế)</h3>
      {rows.length === 0 ? (
        <p className="dash-empty">Chưa có hóa đơn nào được xuất.</p>
      ) : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Số HĐ</th><th>Dự án</th><th>Chủ đầu tư</th>
              <th className="num">Giá trị HĐ</th><th className="num">Đã xuất HĐ</th><th>Ngày ký</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.contract_out_id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-invoice')} {...getRowProps(r)}>
                  <td>{i + 1}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.project_name || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="num" title={fmtFull(r.value_vnd)}>{fmtMoney(r.value_vnd)}</td>
                  <td className="num" title={fmtFull(r.invoiced_vnd)}>{fmtMoney(r.invoiced_vnd)}</td>
                  <td>{fmtDate(r.contract_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {copyMenu}
    </div>
  )
}
