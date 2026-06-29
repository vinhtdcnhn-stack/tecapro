import { useState, useEffect } from 'react'
import { apiGet } from '../../../lib/api'
import { fmtFull } from '../execUtils.js'
import { fmtMoney, fmtDate, endOfThisMonth } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../../components/common/deepLink'

// Text dán chat: khoản phải thu / phải trả đến hạn trong tháng.
const buildRecvText = (r) => {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.customer_name, r.description].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Còn thu: ${fmtMoney(r.remaining_vnd)} đ, Hạn: ${fmtDate(r.due_date)}`
}
const buildPayText = (r) => {
  const crumbs = [r.contract_no ? `HĐ nhập ${r.contract_no}` : null, r.supplier_name, r.description].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Còn trả: ${fmtMoney(r.remaining_vnd)} đ, Hạn: ${fmtDate(r.due_date)}`
}

// Cuối tháng của 1 ngày ISO 'yyyy-mm-dd'.
const endOfMonthOf = (iso) => {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

// Chi tiết thẻ "Dự kiến THU/CHI tháng": tải lười khoản phải thu & phải trả đến hạn trong tháng.
// asOf: xem tại 1 thời điểm → "tháng" = tháng của asOf, đã thu/trả tính tới asOf.
export default function CashflowMonthDetail({ asOf = null, onOpenContract }) {
  const [recv, setRecv] = useState([])
  const [pay, setPay] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const to = asOf ? endOfMonthOf(asOf) : endOfThisMonth()
    const aq = asOf ? `&asOf=${asOf}` : ''
    ;(async () => {
      try {
        const [r, p] = await Promise.all([
          apiGet(`/reports/receivables?to=${to}&basis=actual${aq}`, { conditional: true }),
          apiGet(`/reports/payables?to=${to}${aq}`, { conditional: true }),
        ])
        if (cancelled) return
        setRecv((Array.isArray(r.rows) ? r.rows : []).filter(x => (parseFloat(x.remaining_vnd) || 0) > 0))
        setPay((Array.isArray(p.rows) ? p.rows : []).filter(x => (parseFloat(x.remaining_vnd) || 0) > 0))
      } catch (e) { console.error('cashflow month:', e) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [asOf])

  const recvTotal = recv.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)
  const payTotal = pay.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)
  const recvCopy = useCopyMenu(buildRecvText, (r) => r.description || r.contract_no || 'Khoản phải thu',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-debt' }))
  const payCopy = useCopyMenu(buildPayText, (r) => r.description || r.contract_no || 'Khoản phải trả',
    (r) => contractPath(r.contract_out_id, { tab: 'purchase-contract-info', inId: r.contract_in_id }))

  if (loading) return <p className="dash-empty">Đang tải dự kiến thu/chi tháng...</p>

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip exec-chip--good"><div className="exec-chip-lbl">Dự kiến THU</div>
          <div className="exec-chip-val" title={fmtFull(recvTotal)}>{fmtMoney(recvTotal)} đ</div></div>
        <div className="exec-chip exec-chip--danger"><div className="exec-chip-lbl">Dự kiến CHI</div>
          <div className="exec-chip-val" title={fmtFull(payTotal)}>{fmtMoney(payTotal)} đ</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Chênh lệch ròng</div>
          <div className="exec-chip-val" title={fmtFull(recvTotal - payTotal)}>{fmtMoney(recvTotal - payTotal)} đ</div></div>
      </div>

      <h3 className="exec-detail-h">Khoản phải thu đến hạn trong tháng</h3>
      {recv.length === 0 ? <p className="dash-empty">Không có khoản phải thu đến hạn.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr><th>STT</th><th>Chủ đầu tư</th><th>Số HĐ</th><th>Nội dung</th><th className="num">Còn thu (VNĐ)</th><th>Hạn</th></tr></thead>
            <tbody>
              {recv.map((r, i) => (
                <tr key={r.id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-debt')} {...recvCopy.getRowProps(r)}>
                  <td>{i + 1}</td><td>{r.customer_name || '—'}</td><td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.description || '—'}</td>
                  <td className="num" title={fmtFull(r.remaining_vnd)}>{fmtMoney(r.remaining_vnd)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="exec-detail-h">Khoản phải trả NCC đến hạn trong tháng</h3>
      {pay.length === 0 ? <p className="dash-empty">Không có khoản phải trả đến hạn.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr><th>STT</th><th>Nhà cung cấp</th><th>Số HĐ nhập</th><th>Nội dung</th><th className="num">Còn trả (VNĐ)</th><th>Hạn</th></tr></thead>
            <tbody>
              {pay.map((r, i) => (
                <tr key={r.id}
                  className={r.contract_out_id ? 'exec-row' : undefined}
                  onClick={r.contract_out_id ? () => onOpenContract(r.contract_out_id, 'purchase-contract-info', { inId: r.contract_in_id }) : undefined}
                  {...payCopy.getRowProps(r)}>
                  <td>{i + 1}</td><td>{r.supplier_name || '—'}</td><td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.description || '—'}</td>
                  <td className="num" title={fmtFull(r.remaining_vnd)}>{fmtMoney(r.remaining_vnd)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recvCopy.copyMenu}
      {payCopy.copyMenu}
    </div>
  )
}
