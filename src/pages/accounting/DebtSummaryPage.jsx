import { useState, useEffect } from 'react'
import { apiGet } from '../../lib/api'
import { fmtMoney, fmtDate, fmtPct, exportTable, useContractNav } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import useIsMobile from '../../components/contracts/useIsMobile'
import AccCard from './AccCard.jsx'
import './Accounting.css'

const STATUS_CLASS = { 'Quá hạn': 'st-over', 'Trong hạn': 'st-in', 'Đã thanh toán': 'st-paid' }

// Text dán chat: tổng hợp công nợ theo khách hàng / từng hợp đồng.
const buildCustText = (c) =>
  `📌 ${c.customer_name || 'Khách hàng'} — ${c.total_contracts} HĐ, Tổng giá trị: ${fmtMoney(c.value_vnd)} đ, `
  + `Đã thu: ${fmtMoney(c.paid_vnd)} đ, Công nợ còn lại: ${fmtMoney(c.outstanding_vnd)} đ (tỷ lệ thu ${fmtPct(c.collection_ratio)})`
const buildConText = (k) => {
  const crumbs = [k.contract_no ? `HĐ ${k.contract_no}` : null, k.project_name].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Giá trị: ${fmtMoney(k.value_vnd)} đ, Đã thu: ${fmtMoney(k.paid_vnd)} đ, `
    + `Công nợ: ${fmtMoney(k.outstanding_vnd)} đ, ${k.status || ''}${k.days_overdue > 0 ? ` (quá hạn ${k.days_overdue} ngày)` : ''}`
}

function Card({ label, value, color }) {
  return <div className="acc-stat-card" style={{ borderTopColor: color }}>
    <div className="acc-stat-value" style={{ color, fontSize: 18 }}>{value}</div>
    <div className="acc-stat-label">{label}</div>
  </div>
}

// #8 / #9 — Tổng hợp công nợ theo khách hàng (drill-down sang hợp đồng).
export default function DebtSummaryPage() {
  const [custs, setCusts] = useState([])
  const [contracts, setContracts] = useState([])
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)   // customer_id đang mở
  const goContract = useContractNav()
  const isMobile = useIsMobile()
  const custCopy = useCopyMenu(buildCustText, (c) => c.customer_name || 'Khách hàng')  // mức KH: không gắn 1 HĐ → không có link
  const conCopy = useCopyMenu(buildConText, (k) => k.contract_no || k.project_name || 'Hợp đồng',
    (k) => contractPath(k.contract_out_id, { tab: 'contract-debt' }))

  useEffect(() => {
    let alive = true
    Promise.all([
      apiGet('/reports/debt-by-customer', { conditional: true }).catch(() => null),
      apiGet('/reports/debt-by-contract', { conditional: true }).catch(() => null),
    ]).then(([cu, co]) => {
      if (!alive) return
      setCusts(cu?.rows || []); setTotals(cu?.totals || null)
      setContracts(co?.rows || []); setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const onExport = () => exportTable('Tong-hop-cong-no-KH.xlsx', 'Theo KH', [
    { label: 'Mã KH', value: r => r.customer_code }, { label: 'Khách hàng', value: r => r.customer_name },
    { label: 'Tổng HĐ', value: r => r.total_contracts }, { label: 'Tổng giá trị (VNĐ)', value: r => Math.round(r.value_vnd) },
    { label: 'Đã thu (VNĐ)', value: r => Math.round(r.paid_vnd) }, { label: 'Công nợ còn lại (VNĐ)', value: r => Math.round(r.outstanding_vnd) },
    { label: 'Tỷ lệ thu', value: r => fmtPct(r.collection_ratio) },
  ], custs)

  if (loading) return <p className="dash-empty">Đang tải...</p>

  return (
    <div className="acc-report">
      {totals && (
        <div className="acc-stats">
          <Card label="Tổng giá trị HĐ" value={fmtMoney(totals.total_value) + ' đ'} color="var(--brand)" />
          <Card label="Tổng đã thu" value={fmtMoney(totals.total_paid) + ' đ'} color="#16a34a" />
          <Card label="Tổng công nợ phải thu" value={fmtMoney(totals.total_outstanding) + ' đ'} color="#2563eb" />
          <Card label="Công nợ trong hạn" value={fmtMoney(totals.in_term) + ' đ'} color="#0891b2" />
          <Card label="Công nợ quá hạn" value={fmtMoney(totals.overdue) + ' đ'} color="#dc2626" />
          <Card label="Tỷ lệ thu hồi" value={fmtPct(totals.collection_ratio)} color="#7c3aed" />
        </div>
      )}

      <div className="acc-report-toolbar">
        <span className="acc-section-title" style={{ margin: 0 }}>Tổng hợp theo khách hàng — bấm để xem hợp đồng</span>
        {!isMobile && <button className="acc-export" onClick={onExport} disabled={!custs.length}>⬇ Excel</button>}
      </div>

      {isMobile ? (
        <div className="acc-cards">
          {custs.map(c => {
            const isOpen = open === c.customer_id
            const kids = isOpen ? contracts.filter(x => String(x.customer_id) === String(c.customer_id)) : []
            return (
              <AccCard key={`c${c.customer_id}`}
                title={`${isOpen ? '▾ ' : '▸ '}${c.customer_name || '—'}`}
                sub={c.customer_code}
                badge={<span className="acc-tier tier-1">{fmtPct(c.collection_ratio)}</span>}
                rowProps={custCopy.getRowProps(c)}
                onClick={() => setOpen(isOpen ? null : c.customer_id)}
                rows={[
                  ['Tổng HĐ', c.total_contracts],
                  ['Tổng giá trị', fmtMoney(c.value_vnd)],
                  ['Đã thu', fmtMoney(c.paid_vnd)],
                  ['Công nợ còn lại', fmtMoney(c.outstanding_vnd)],
                ]}>
                {isOpen && kids.length > 0 && (
                  <div className="acc-card-kids" onClick={(e) => e.stopPropagation()}>
                    {kids.map(k => (
                      <AccCard key={`k${k.contract_out_id}`}
                        title={<span className="mono">{k.contract_no}</span>}
                        sub={k.project_name}
                        badge={<span className={`acc-status ${STATUS_CLASS[k.status] || ''}`}>{k.status}{k.days_overdue > 0 ? ` ${k.days_overdue}n` : ''}</span>}
                        rowProps={conCopy.getRowProps(k)}
                        onClick={() => goContract(k.contract_out_id, { tab: 'contract-debt' })}
                        rows={[
                          ['Ngày HĐ', fmtDate(k.contract_date)],
                          ['Giá trị', fmtMoney(k.value_vnd)],
                          ['Đã thu', fmtMoney(k.paid_vnd)],
                          ['Công nợ', fmtMoney(k.outstanding_vnd)],
                        ]} />
                    ))}
                  </div>
                )}
              </AccCard>
            )
          })}
        </div>
      ) : (
      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead><tr>
            <th>Mã KH</th><th>Khách hàng</th><th className="num">Tổng HĐ</th><th className="num">Tổng giá trị</th>
            <th className="num">Đã thu</th><th className="num">Công nợ còn lại</th><th className="num">Tỷ lệ thu</th>
          </tr></thead>
          <tbody>
            {custs.map(c => {
              const isOpen = open === c.customer_id
              const kids = isOpen ? contracts.filter(x => String(x.customer_id) === String(c.customer_id)) : []
              return [
                <tr key={`c${c.customer_id}`} className="acc-row-click" onClick={() => setOpen(isOpen ? null : c.customer_id)} {...custCopy.getRowProps(c)}>
                  <td>{isOpen ? '▾ ' : '▸ '}{c.customer_code || '—'}</td>
                  <td>{c.customer_name}</td>
                  <td className="num">{c.total_contracts}</td>
                  <td className="num">{fmtMoney(c.value_vnd)}</td>
                  <td className="num">{fmtMoney(c.paid_vnd)}</td>
                  <td className="num">{fmtMoney(c.outstanding_vnd)}</td>
                  <td className="num">{fmtPct(c.collection_ratio)}</td>
                </tr>,
                ...kids.map(k => (
                  <tr key={`k${k.contract_out_id}`} className="acc-row-sub acc-row-link" title="Bấm để mở công nợ phải thu của hợp đồng"
                      {...conCopy.getRowProps(k)} onClick={() => goContract(k.contract_out_id, { tab: 'contract-debt' })}>
                    <td colSpan={2}><span className="mono">{k.contract_no}</span> · {k.project_name || '—'}</td>
                    <td>{fmtDate(k.contract_date)}</td>
                    <td className="num">{fmtMoney(k.value_vnd)}</td>
                    <td className="num">{fmtMoney(k.paid_vnd)}</td>
                    <td className="num">{fmtMoney(k.outstanding_vnd)}</td>
                    <td><span className={`acc-status ${STATUS_CLASS[k.status] || ''}`}>{k.status}{k.days_overdue > 0 ? ` ${k.days_overdue}n` : ''}</span></td>
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>
      </div>
      )}
      {custCopy.copyMenu}
      {conCopy.copyMenu}
    </div>
  )
}
