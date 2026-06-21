import { fmtFull } from '../execUtils.js'
import { fmtMoney, fmtPct } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'

// Text dán chat: đã thu theo chủ đầu tư.
const buildCopyText = (r) =>
  `📌 ${r.customer_name || 'Chủ đầu tư'} — Giá trị: ${fmtMoney(r.value_vnd)} đ, Đã thu: ${fmtMoney(r.paid_vnd)} đ, `
  + `Còn nợ: ${fmtMoney(r.outstanding_vnd)} đ (tỷ lệ thu ${fmtPct(r.collection_ratio)}, ${r.total_contracts} HĐ)`

// Chi tiết thẻ "Doanh thu đã thu": top chủ đầu tư theo số đã thu + tỷ lệ thu.
export default function CollectedDetail({ byCustomer }) {
  const rows = [...(byCustomer?.rows || [])].sort(
    (a, b) => (parseFloat(b.paid_vnd) || 0) - (parseFloat(a.paid_vnd) || 0))
  const t = byCustomer?.totals || {}
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.customer_name || 'Chủ đầu tư')

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip"><div className="exec-chip-lbl">Tổng đã thu</div>
          <div className="exec-chip-val" title={fmtFull(t.total_paid)}>{fmtMoney(t.total_paid)} đ</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Đã xuất hóa đơn</div>
          <div className="exec-chip-val" title={fmtFull(t.total_invoiced)}>{fmtMoney(t.total_invoiced)} đ</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Tỷ lệ thu chung</div>
          <div className="exec-chip-val">{fmtPct(t.collection_ratio)}</div></div>
      </div>

      <h3 className="exec-detail-h">Chủ đầu tư theo số đã thu</h3>
      {rows.length === 0 ? <p className="dash-empty">Chưa có dữ liệu.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>STT</th><th>Chủ đầu tư</th><th className="num">Số HĐ</th>
                <th className="num">Giá trị</th><th className="num">Đã thu</th>
                <th className="num">Còn nợ</th><th className="num">Tỷ lệ thu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.customer_id} {...getRowProps(r)}>
                  <td>{i + 1}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="num">{r.total_contracts}</td>
                  <td className="num" title={fmtFull(r.value_vnd)}>{fmtMoney(r.value_vnd)}</td>
                  <td className="num" title={fmtFull(r.paid_vnd)}>{fmtMoney(r.paid_vnd)}</td>
                  <td className="num">{fmtMoney(r.outstanding_vnd)}</td>
                  <td className="num">{fmtPct(r.collection_ratio)}</td>
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
