import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '../../lib/api'
import { fmtMoney, fmtDate, exportTable, useContractNav, todayLocal } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import DateInput from '../../components/contracts/DateInput.jsx'
import useIsMobile from '../../components/contracts/useIsMobile'
import AccCard from './AccCard.jsx'
import AccSearch, { useReportSearch } from './AccSearch.jsx'
import './Accounting.css'

const SEARCH_FIELDS = ['invoice_no', 'contract_no', 'customer_name', 'project_name']
const startOfYear = () => `${new Date().getFullYear()}-01-01`

const LS_KEY = 'invoiceRevenue.range'
const loadRange = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
// Khoảng ngày [đầu tháng, cuối tháng] của tháng chứa mốc (year, month 0-based).
const monthRangeOf = (y, m) => {
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return {
    from: ymd(first.getFullYear(), first.getMonth() + 1, 1),
    to: ymd(last.getFullYear(), last.getMonth() + 1, last.getDate()),
  }
}
// Khoảng của tháng hiện tại.
const currentMonthRange = () => {
  const now = new Date()
  return monthRangeOf(now.getFullYear(), now.getMonth())
}

// Text dán chat: một hóa đơn đã xuất.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.project_name, r.customer_name].filter(Boolean)
  return `🧾 HĐ ${r.invoice_no || '(chưa số)'} — ${crumbs.join(' › ')}: ${fmtMoney(r.amount_vnd)} đ`
    + `${r.currency_code && r.currency_code !== 'VND' ? ` (${fmtMoney(r.amount_native)} ${r.currency_code})` : ''}`
    + `, ngày ${fmtDate(r.invoice_date)}`
}

// Doanh thu xuất hóa đơn (HĐ bán) theo khoảng ngày do người dùng chọn.
export default function InvoiceRevenueReportPage() {
  const saved = loadRange()
  const [from, setFrom] = useState(saved.from || startOfYear())
  const [to, setTo] = useState(saved.to || todayLocal())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.invoice_no || r.contract_no || 'Hóa đơn',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-invoice' }))
  const goContract = useContractNav()
  const isMobile = useIsMobile()

  // Nhảy tới tháng hiện tại.
  const goCurrentMonth = () => {
    const { from: f, to: t } = currentMonthRange()
    setFrom(f)
    setTo(t)
  }
  // Lùi/tiến một tháng so với khoảng đang chọn (bấm nhiều lần chạy dần).
  const shiftMonth = (delta) => {
    const base = from ? new Date(from) : new Date()
    const { from: f, to: t } = monthRangeOf(base.getFullYear(), base.getMonth() + delta)
    setFrom(f)
    setTo(t)
  }
  // Không cho sang tháng tương lai: chặn khi tháng đang chọn >= tháng hiện tại.
  const nextDisabled = useMemo(() => {
    const base = from ? new Date(from) : new Date()
    const now = new Date()
    return base.getFullYear() * 12 + base.getMonth() >= now.getFullYear() * 12 + now.getMonth()
  }, [from])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ from, to })) } catch { /* ignore */ }
  }, [from, to])

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

  const allRows = useMemo(() => (data && Array.isArray(data.rows) ? data.rows : []), [data])
  const { query, setQuery, filtered: rows } = useReportSearch(allRows, SEARCH_FIELDS)
  const total = useMemo(() => rows.reduce((s, r) => s + (parseFloat(r.amount_vnd) || 0), 0), [rows])

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
      <div className="acc-report-toolbar">
        {!isMobile && <button className="acc-export" onClick={onExport} disabled={!rows.length}>⬇ Excel</button>}
        <label className="acc-field">Từ ngày
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
        </label>
        <label className="acc-field">Đến ngày
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
        </label>
        <button type="button" className="acc-quick-range" onClick={() => shiftMonth(-1)}>Tháng trước</button>
        <button type="button" className="acc-quick-range" onClick={goCurrentMonth}>Tháng hiện tại</button>
        <button type="button" className="acc-quick-range" onClick={() => shiftMonth(1)} disabled={nextDisabled}>Tháng sau</button>
        <AccSearch value={query} onChange={setQuery} placeholder="Tìm số hóa đơn, HĐ, CĐT, dự án..." />
        <span className="acc-report-total">
          Tổng doanh thu: <strong style={{ color: 'var(--brand)' }}>{fmtMoney(total)} đ</strong>
          {' '}({rows.length} hóa đơn)
        </span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">{query ? 'Không có hóa đơn nào khớp tìm kiếm.' : 'Không có hóa đơn nào trong khoảng ngày đã chọn.'}</p>
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
