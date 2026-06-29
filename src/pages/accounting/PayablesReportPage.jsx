import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../../lib/api'
import { fmtMoney, fmtDate, TIER_CLASS, todayLocal, exportTable, useContractNav } from './reportUtils'
import ReportPeriodField from './ReportPeriodField.jsx'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import useIsMobile from '../../components/contracts/useIsMobile'
import AccCard from './AccCard.jsx'
import './Accounting.css'

// Text dán chat: một khoản công nợ phải trả NCC.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ nhập ${r.contract_no}` : null, r.supplier_name, r.description].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Cần trả: ${fmtMoney(r.amount)} ${r.currency_code || ''}, `
    + `Đã trả: ${fmtMoney(r.paid)}, Còn nợ: ${fmtMoney(r.remaining)} (${fmtMoney(r.remaining_vnd)} đ), `
    + `Hạn trả: ${fmtDate(r.due_date)}${r.days_overdue > 0 ? ` (quá hạn ${r.days_overdue} ngày)` : ''}`
}

// #5 — Công nợ phải trả NCC (đã trả phân bổ FIFO theo hạn).
export default function PayablesReportPage() {
  const [to, setTo]     = useState(todayLocal)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.description || r.contract_no || 'Khoản phải trả',
    (r) => contractPath(r.contract_out_id, { tab: 'purchase-contract-info', inId: r.contract_in_id, inTab: 'payment' }))
  const goContract = useContractNav()
  const isMobile = useIsMobile()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Chỉ gửi asOf (≤ hôm nay): chốt số liệu ĐÚNG tại ngày báo cáo (đã trả/giá trị/quá
      // hạn tính tới ngày đó), dựng lại từ record_history. Backend tự lấy cận lọc
      // to = cuối tháng của asOf → vẫn liệt kê đủ đợt đáo hạn trong tháng đó.
      const data = await apiGet(`/reports/payables?asOf=${to}`, { conditional: true })
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) { console.error('payables report:', e) }
    finally { setLoading(false) }
  }, [to])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const totalVnd = rows.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)

  const onExport = () => exportTable(`Cong-no-phai-tra-${to}.xlsx`, 'Phai tra', [
    { label: 'Mã NCC', value: r => r.supplier_code }, { label: 'Nhà cung cấp', value: r => r.supplier_name },
    { label: 'Số HĐ nhập', value: r => r.contract_no }, { label: 'Ngày HĐ', value: r => fmtDate(r.contract_date) },
    { label: 'Nội dung', value: r => r.description }, { label: 'Cần trả', value: r => r.amount },
    { label: 'Đã trả', value: r => r.paid }, { label: 'Còn nợ', value: r => r.remaining },
    { label: 'Tiền tệ', value: r => r.currency_code }, { label: 'Quy đổi VNĐ', value: r => Math.round(r.remaining_vnd) },
    { label: 'Hạn trả', value: r => fmtDate(r.due_date) }, { label: 'Số ngày quá hạn', value: r => r.days_overdue },
    { label: 'Nhóm nợ', value: r => r.tier_label || '' },
  ], rows)

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar">
        <ReportPeriodField value={to} onChange={setTo} />
        {!isMobile && <button className="acc-export" onClick={onExport} disabled={!rows.length}>⬇ Excel</button>}
        <span className="acc-report-total">Tổng phải trả: <strong>{fmtMoney(totalVnd)} đ</strong> · {rows.length} khoản</span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">Không có công nợ phải trả trong kỳ.</p>
        : isMobile ? (
        <div className="acc-cards">
          {rows.map((r) => (
            <AccCard key={r.id}
              title={<span className="mono">{r.contract_no || '—'}</span>}
              sub={r.supplier_name}
              badge={r.tier ? <span className={`acc-tier ${TIER_CLASS[r.tier]}`}>{r.tier_label}</span> : null}
              rowProps={getRowProps(r)}
              onClick={() => goContract(r.contract_out_id, { tab: 'purchase-contract-info', inId: r.contract_in_id, inTab: 'payment' })}
              rows={[
                ['Mã NCC', r.supplier_code],
                ['Nội dung', r.description],
                ['Cần trả', `${fmtMoney(r.amount)} ${r.currency_code || ''}`],
                ['Đã trả', fmtMoney(r.paid)],
                ['Còn nợ', fmtMoney(r.remaining)],
                ['Quy đổi VNĐ', fmtMoney(r.remaining_vnd)],
                ['Hạn trả', fmtDate(r.due_date)],
                ['Quá hạn', r.days_overdue > 0 ? `${r.days_overdue} ngày` : '—'],
              ]} />
          ))}
        </div>
      ) : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Mã NCC</th><th>Nhà cung cấp</th><th>Số HĐ nhập</th><th>Nội dung</th>
              <th className="num">Cần trả</th><th className="num">Đã trả</th><th className="num">Còn nợ</th>
              <th className="num">Quy đổi VNĐ</th><th>Hạn trả</th><th className="num">Quá hạn</th><th>Nhóm nợ</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="acc-row-link" title="Bấm để mở thanh toán của hợp đồng nhập"
                    {...getRowProps(r)}
                    onClick={() => goContract(r.contract_out_id, { tab: 'purchase-contract-info', inId: r.contract_in_id, inTab: 'payment' })}>
                  <td>{i + 1}</td><td>{r.supplier_code || '—'}</td><td>{r.supplier_name || '—'}</td>
                  <td className="mono">{r.contract_no || '—'}</td><td>{r.description || '—'}</td>
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
