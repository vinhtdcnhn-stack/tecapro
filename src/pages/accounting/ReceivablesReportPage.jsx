import { useState, useEffect, useCallback } from 'react'
import { API_BASE as API } from '../../config/api'
import { fmtMoney, fmtDate, TIER_CLASS, todayLocal, exportTable } from './reportUtils'
import ReportPeriodField from './ReportPeriodField.jsx'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import './Accounting.css'

// Text dán chat: một khoản công nợ phải thu.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.customer_name, r.description].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Cần thu: ${fmtMoney(r.amount)} ${r.currency_code || ''}, `
    + `Đã thu: ${fmtMoney(r.paid)}, Còn nợ: ${fmtMoney(r.remaining)} (${fmtMoney(r.remaining_vnd)} đ), `
    + `Hạn thu: ${fmtDate(r.due_date)}${r.days_overdue > 0 ? ` (quá hạn ${r.days_overdue} ngày)` : ''}`
}

// #3 / #4 — Công nợ phải thu KH (theo kế hoạch gốc hoặc tiến độ thực).
export default function ReceivablesReportPage() {
  const [to, setTo]       = useState(todayLocal)
  const [basis, setBasis] = useState('actual')
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.description || r.contract_no || 'Khoản phải thu')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Chỉ gửi asOf (≤ hôm nay): chốt số liệu ĐÚNG tại ngày báo cáo (đã thu/giá trị HĐ/
      // quá hạn tính tới ngày đó), dựng lại từ record_history. Backend tự lấy cận lọc
      // to = cuối tháng của asOf → vẫn liệt kê đủ khoản đáo hạn trong tháng đó.
      const res = await fetch(`${API}/api/reports/receivables?asOf=${to}&basis=${basis}`)
      const data = await res.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) { console.error('receivables report:', e) }
    finally { setLoading(false) }
  }, [to, basis])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const totalVnd = rows.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)

  const onExport = () => exportTable(`Cong-no-phai-thu-${to}.xlsx`, 'Phai thu', [
    { label: 'Mã KH', value: r => r.customer_code }, { label: 'Khách hàng', value: r => r.customer_name },
    { label: 'Số HĐ', value: r => r.contract_no }, { label: 'Ngày HĐ', value: r => fmtDate(r.contract_date) },
    { label: 'Nội dung', value: r => r.description }, { label: '% theo HĐ', value: r => r.ratio_pct == null ? '' : r.ratio_pct.toFixed(2) },
    { label: 'Cần thu', value: r => r.amount }, { label: 'Đã thu', value: r => r.paid }, { label: 'Còn nợ', value: r => r.remaining },
    { label: 'Tiền tệ', value: r => r.currency_code }, { label: 'Quy đổi VNĐ', value: r => Math.round(r.remaining_vnd) },
    { label: 'Hạn thu', value: r => fmtDate(r.due_date) }, { label: 'Số ngày quá hạn', value: r => r.days_overdue },
    { label: 'Nhóm nợ', value: r => r.tier_label || '' },
  ], rows)

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar">
        <ReportPeriodField value={to} onChange={setTo} />
        <div className="acc-seg">
          <button className={basis === 'actual' ? 'active' : ''} onClick={() => setBasis('actual')}>Theo tiến độ thực</button>
          <button className={basis === 'plan' ? 'active' : ''} onClick={() => setBasis('plan')}>Theo kế hoạch gốc</button>
        </div>
        <button className="acc-export" onClick={onExport} disabled={!rows.length}>⬇ Excel</button>
        <span className="acc-report-total">Tổng còn nợ: <strong>{fmtMoney(totalVnd)} đ</strong> · {rows.length} khoản</span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">Không có công nợ phải thu trong kỳ.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Mã KH</th><th>Khách hàng</th><th>Số HĐ</th><th>Nội dung</th>
              <th className="num">% HĐ</th><th className="num">Cần thu</th><th className="num">Đã thu</th>
              <th className="num">Còn nợ</th><th className="num">Quy đổi VNĐ</th><th>Hạn thu</th>
              <th className="num">Quá hạn</th><th>Nhóm nợ</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} {...getRowProps(r)}>
                  <td>{i + 1}</td><td>{r.customer_code || '—'}</td><td>{r.customer_name || '—'}</td>
                  <td className="mono">{r.contract_no}</td><td>{r.description || '—'}</td>
                  <td className="num">{r.ratio_pct == null ? '—' : r.ratio_pct.toFixed(1) + '%'}</td>
                  <td className="num">{fmtMoney(r.amount)} {r.currency_code}</td>
                  <td className="num">{fmtMoney(r.paid)}</td>
                  <td className="num">{fmtMoney(r.remaining)}</td>
                  <td className="num">{fmtMoney(r.remaining_vnd)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td className="num">{r.days_overdue > 0 ? r.days_overdue : '—'}</td>
                  <td>{r.tier ? <span className={`acc-tier ${TIER_CLASS[r.tier]}`}>{r.tier_label}</span> : '—'}</td>
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
