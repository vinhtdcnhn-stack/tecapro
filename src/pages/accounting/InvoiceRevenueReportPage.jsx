import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '../../lib/api'
import { fmtMoney, fmtDate, exportTable, useContractNav, todayLocal } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import DateInput from '../../components/contracts/DateInput.jsx'
import useIsMobile from '../../components/contracts/useIsMobile'
import AccCard from './AccCard.jsx'
import './Accounting.css'

const startOfYear = () => `${new Date().getFullYear()}-01-01`

// Text dán chat: một hóa đơn đã xuất.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.project_name, r.customer_name].filter(Boolean)
  return `🧾 HĐ ${r.invoice_no || '(chưa số)'} — ${crumbs.join(' › ')}: ${fmtMoney(r.amount_vnd)} đ`
    + `${r.currency_code && r.currency_code !== 'VND' ? ` (${fmtMoney(r.amount_native)} ${r.currency_code})` : ''}`
    + `, ngày ${fmtDate(r.invoice_date)}`
}

// Doanh thu xuất hóa đơn (HĐ bán) theo khoảng ngày do người dùng chọn.
export default function InvoiceRevenueReportPage() {
  const [from, setFrom] = useState(startOfYear())
  const [to, setTo] = useState(todayLocal())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.invoice_no || r.contract_no || 'Hóa đơn',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-invoice' }))
  const goContract = useContractNav()
  const isMobile = useIsMobile()

  useEffect(() => {
    let alive = true
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    apiGet(`/reports/invoice-revenue?${qs.toString()}`, { conditional: true })
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [from, to])

  const rows = useMemo(() => (data && Array.isArray(data.rows) ? data.rows : []), [data])
  const total = data ? data.total_vnd : 0

  const onExport = () => exportTable('Doanh-thu-xuat-hoa-don.xlsx', 'Doanh thu HD', [
    { label: 'Số hóa đơn', value: r => r.invoice_no },
    { label: 'Ngày xuất', value: r => fmtDate(r.invoice_date) },
    { label: 'Số HĐ', value: r => r.contract_no },
    { label: 'CĐT', value: r => r.customer_name },
    { label: 'Dự án', value: r => r.project_name },
    { label: 'Loại tiền', value: r => r.currency_code },
    { label: 'Giá trị (nguyên tệ)', value: r => Math.round((r.amount_native || 0) * 100) / 100 },
    { label: 'Quy đổi VNĐ', value: r => Math.round(r.amount_vnd) },
  ], rows)

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar" style={{ alignItems: 'flex-end' }}>
        {!isMobile && <button className="acc-export" onClick={onExport} disabled={!rows.length}>⬇ Excel</button>}
        <label className="acc-field">Từ ngày
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
        </label>
        <label className="acc-field">Đến ngày
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
        </label>
        <span className="acc-report-total">
          Tổng doanh thu: <strong style={{ color: 'var(--brand)' }}>{fmtMoney(total)} đ</strong>
          {' '}({rows.length} hóa đơn)
        </span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">Không có hóa đơn nào trong khoảng ngày đã chọn.</p>
        : isMobile ? (
        <div className="acc-cards">
          {rows.map((r) => (
            <AccCard key={r.id}
              title={<span className="mono">{r.invoice_no || '(chưa số)'}</span>}
              sub={r.customer_name}
              badge={<span className="mono">{fmtMoney(r.amount_vnd)} đ</span>}
              rowProps={getRowProps(r)}
              onClick={() => goContract(r.contract_out_id, { tab: 'contract-invoice' })}
              rows={[
                ['Ngày xuất', fmtDate(r.invoice_date)],
                ['Số HĐ', r.contract_no],
                ['Dự án', r.project_name],
                ['Giá trị', r.currency_code && r.currency_code !== 'VND'
                  ? `${fmtMoney(r.amount_native)} ${r.currency_code}` : `${fmtMoney(r.amount_vnd)} đ`],
              ]} />
          ))}
        </div>
      ) : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Số hóa đơn</th><th>Ngày xuất</th><th>Số HĐ</th><th>CĐT</th><th>Dự án</th>
              <th className="num">Giá trị (nguyên tệ)</th><th className="num">Quy đổi VNĐ</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="acc-row-link" title="Bấm để mở hóa đơn của hợp đồng"
                    {...getRowProps(r)} onClick={() => goContract(r.contract_out_id, { tab: 'contract-invoice' })}>
                  <td>{i + 1}</td>
                  <td className="mono">{r.invoice_no || '—'}</td>
                  <td>{fmtDate(r.invoice_date)}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td>{r.project_name || '—'}</td>
                  <td className="num">{r.currency_code && r.currency_code !== 'VND'
                    ? `${fmtMoney(r.amount_native)} ${r.currency_code}` : fmtMoney(r.amount_native)}</td>
                  <td className="num">{fmtMoney(r.amount_vnd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="num"><strong>Tổng cộng</strong></td>
                <td className="num"><strong>{fmtMoney(total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {copyMenu}
    </div>
  )
}
