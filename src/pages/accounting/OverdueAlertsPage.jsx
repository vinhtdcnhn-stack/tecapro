import { useState, useEffect, useCallback } from 'react'
import { API_BASE as API } from '../../config/api'
import { useContractNav } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import './Accounting.css'

const TIER_CLASS = {
  '1-7':  'tier-1',
  '8-15': 'tier-2',
  '16-30':'tier-3',
  '>30':  'tier-4',
}

const fmtMoney = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

// Text dán chat: một khoản nợ quá hạn.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.customer_name, r.description].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Còn nợ: ${fmtMoney(r.remaining)} ${r.currency_code || ''}`
    + ` (${fmtMoney(r.remaining_vnd)} đ), Hạn TT: ${fmtDate(r.due_date)} (quá hạn ${r.days_overdue} ngày, ${r.tier_label || ''})`
}

// Bảng cảnh báo nợ quá hạn (sheet #1). Dùng cả như sub-view trong trang chủ kế toán.
export default function OverdueAlertsPage() {
  const asOf = new Date().toISOString().slice(0, 10)   // luôn kiểm tra tại ngày hiện tại
  const [basis, setBasis] = useState('actual')   // 'actual' | 'plan'
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.description || r.contract_no || 'Khoản nợ')
  const goContract = useContractNav()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/reports/overdue-receivables?asOf=${asOf}&basis=${basis}`)
      const data = await res.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) { console.error('overdue report:', e) }
    finally { setLoading(false) }
  }, [asOf, basis])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(() => { load() }, [load])

  const overdueRows = rows.filter(r => r.days_overdue > 0)
  const totalVnd = overdueRows.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar">
        <div className="acc-seg">
          <button className={basis === 'actual' ? 'active' : ''} onClick={() => setBasis('actual')}>Theo tiến độ thực</button>
          <button className={basis === 'plan' ? 'active' : ''} onClick={() => setBasis('plan')}>Theo kế hoạch gốc</button>
        </div>
        <span className="acc-report-total">Tổng nợ quá hạn: <strong>{fmtMoney(totalVnd)} đ</strong> · {overdueRows.length} khoản</span>
      </div>

      {loading ? (
        <p className="dash-empty">Đang tải...</p>
      ) : overdueRows.length === 0 ? (
        <p className="dash-empty">Không có khoản nợ quá hạn. 🎉</p>
      ) : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>STT</th><th>Mã KH</th><th>Khách hàng</th><th>Số HĐ</th><th>Nội dung</th>
                <th className="num">Còn nợ</th><th className="num">Quy đổi VNĐ</th>
                <th>Hạn TT</th><th className="num">Tỷ lệ thu</th><th className="num">Quá hạn (ngày)</th><th>Nhóm nợ</th>
              </tr>
            </thead>
            <tbody>
              {overdueRows.map((r, i) => (
                <tr key={r.id} className="acc-row-link" title="Bấm để mở công nợ phải thu của hợp đồng"
                    {...getRowProps(r)} onClick={() => goContract(r.contract_out_id, { tab: 'contract-debt' })}>
                  <td>{i + 1}</td>
                  <td>{r.customer_code || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.description || '—'}</td>
                  <td className="num">{fmtMoney(r.remaining)} {r.currency_code}</td>
                  <td className="num">{fmtMoney(r.remaining_vnd)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td className="num">{Math.round((r.recovery_ratio || 0) * 100)}%</td>
                  <td className="num">{r.days_overdue}</td>
                  <td><span className={`acc-tier ${TIER_CLASS[r.tier] || ''}`}>{r.tier_label}</span></td>
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
