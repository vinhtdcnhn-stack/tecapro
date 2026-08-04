import { fmtCompact, fmtFull, groupByStatus } from '../execUtils.js'
import { fmtMoney, fmtDate } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../../components/common/deepLink'

// Chú thích cột tiền: giá trị VNĐ đầy đủ, kèm nguyên tệ khi HĐ không phải VND
// (số trong bảng là bản quy đổi VNĐ — xem "Currency / Value Convention").
function moneyTitle(vnd, native, code) {
  const full = fmtFull(vnd)
  if (!code || code === 'VND' || native == null) return full
  return `${full} (${fmtMoney(native)} ${code})`
}

// Text dán chat: hợp đồng theo giá trị.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.project_name, r.customer_name].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Ngày ký: ${r.contract_date ? fmtDate(r.contract_date) : '—'}, `
    + `Giá trị trước VAT: ${fmtMoney(r.value_before_vnd)} đ, Giá trị sau VAT: ${fmtMoney(r.value_vnd)} đ, `
    + `PM: ${r.pm_name || '—'}`
}

// Chi tiết thẻ "Tổng giá trị HĐ": cơ cấu theo trạng thái + bảng tất cả HĐ theo giá trị.
export default function PortfolioDetail({ contracts = [], byContract, onOpenContract }) {
  const groups = groupByStatus(contracts)
  const rows = [...(byContract?.rows || [])].sort(
    (a, b) => (parseFloat(b.value_vnd) || 0) - (parseFloat(a.value_vnd) || 0))
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.contract_no || r.project_name || 'Hợp đồng',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-info' }))

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
                <th>STT</th><th>Số HĐ</th><th>Ngày ký</th><th>CĐT</th>
                <th className="num">Giá trị trước VAT</th><th className="num">Giá trị sau VAT</th>
                <th>Dự án</th><th>PM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.contract_out_id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-info')} {...getRowProps(r)}>
                  <td>{i + 1}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.contract_date ? fmtDate(r.contract_date) : '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="num" title={moneyTitle(r.value_before_vnd, r.amount_before_vat, r.currency_code)}>{fmtMoney(r.value_before_vnd)}</td>
                  <td className="num" title={moneyTitle(r.value_vnd, r.amount_after_vat, r.currency_code)}>{fmtMoney(r.value_vnd)}</td>
                  <td>{r.project_name || '—'}</td>
                  <td>{r.pm_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="exec-detail-note">Bấm vào một dòng để mở hợp đồng. Tổng {rows.length} hợp đồng.</p>
      {copyMenu}
    </div>
  )
}
