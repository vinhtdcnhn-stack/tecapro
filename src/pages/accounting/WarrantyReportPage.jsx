import { useState, useEffect, Fragment } from 'react'
import { API_BASE as API } from '../../config/api'
import { fmtDate, fmtPct, exportTable, useContractNav } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import useIsMobile from '../../components/contracts/useIsMobile'
import AccCard from './AccCard.jsx'
import './Accounting.css'

const ST_CLASS = { 'Còn hiệu lực': 'st-in', 'Sắp hết hạn': 'st-warn', 'Hết hiệu lực': 'st-over' }

// Text dán chat: tình trạng bảo hành theo HĐ / một yêu cầu bảo hành.
const buildContractText = (c) =>
  `📌 HĐ ${c.contract_no || ''}${c.customer_name ? ` › ${c.customer_name}` : ''} — ${c.device_count} TB `
  + `(còn hạn ${c.valid_count}, hết hạn ${c.expired_count}), Hết BH: ${fmtDate(c.earliest_expiry)} → ${fmtDate(c.latest_expiry)}, ${c.status || ''}`
const buildCaseText = (c) =>
  `📌 Phiếu BH ${c.case_no || c.id}${c.contract_no ? ` › HĐ ${c.contract_no}` : ''} — ${c.title || ''}`
  + `${c.reported_by ? `, báo bởi ${c.reported_by}` : ''}, tiếp nhận ${fmtDate(c.reported_date)}, ${c.status || ''}`

function Card({ label, value, color }) {
  return <div className="acc-stat-card" style={{ borderTopColor: color }}>
    <div className="acc-stat-value" style={{ color }}>{value}</div>
    <div className="acc-stat-label">{label}</div>
  </div>
}

// #10 — Báo cáo tình trạng bảo hành (roll-up theo thiết bị).
export default function WarrantyReportPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const goContract = useContractNav()
  const isMobile = useIsMobile()
  const warrantyLink = (c) => contractPath(c.contract_out_id, { tab: 'contract-warranty' })
  const contractCopy = useCopyMenu(buildContractText, (c) => c.contract_no || 'Hợp đồng', warrantyLink)
  const caseCopy = useCopyMenu(buildCaseText, (c) => c.title || c.case_no || 'Yêu cầu BH', warrantyLink)

  useEffect(() => {
    let alive = true
    fetch(`${API}/api/reports/warranty`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <p className="dash-empty">Đang tải...</p>
  if (!data) return <p className="dash-empty">Không tải được dữ liệu.</p>
  const s = data.summary

  const onExport = () => exportTable('Tinh-trang-bao-hanh.xlsx', 'Theo HD', [
    { label: 'Số HĐ', value: r => r.contract_no }, { label: 'Khách hàng', value: r => r.customer_name },
    { label: 'Số thiết bị BH', value: r => r.device_count }, { label: 'Còn hạn', value: r => r.valid_count },
    { label: 'Hết hạn', value: r => r.expired_count }, { label: 'Hết BH sớm nhất', value: r => fmtDate(r.earliest_expiry) },
    { label: 'Hết BH muộn nhất', value: r => fmtDate(r.latest_expiry) }, { label: 'Trạng thái', value: r => r.status },
  ], data.contracts)

  return (
    <div className="acc-report">
      <div className="acc-stats">
        <Card label="HĐ có bảo hành" value={s.contracts_with_warranty} color="var(--brand)" />
        <Card label="HĐ còn bảo hành" value={s.still_valid} color="#16a34a" />
        <Card label="HĐ sắp hết (≤30 ngày)" value={s.expiring_30d} color="#d97706" />
        <Card label="HĐ hết bảo hành" value={s.expired} color="#dc2626" />
        <Card label="Tổng yêu cầu BH" value={s.total_cases} color="#2563eb" />
        <Card label="Đã xử lý / Đang xử lý" value={`${s.resolved_cases} / ${s.processing_cases}`} color="#0891b2" />
        <Card label="Tỷ lệ đã xử lý" value={fmtPct(s.resolved_ratio)} color="#7c3aed" />
        <Card label="Số lần BH TB/HĐ" value={(s.avg_cases_per_contract || 0).toFixed(2)} color="#6b7280" />
      </div>

      {data.top_products?.length > 0 && (
        <>
          <div className="acc-section-title">Top sản phẩm/dịch vụ phát sinh lỗi nhiều nhất</div>
          {isMobile ? (
            <div className="acc-cards" style={{ marginBottom: 18 }}>
              {data.top_products.map((t, i) => (
                <AccCard key={i} title={t.name || '—'}
                  badge={<span className="acc-tier tier-2">{t.n} lần</span>} />
              ))}
            </div>
          ) : (
          <div className="acc-table-wrap" style={{ marginBottom: 18 }}>
            <table className="acc-table"><thead><tr><th>Sản phẩm/Dịch vụ</th><th className="num">Số lần BH</th></tr></thead>
              <tbody>{data.top_products.map((t, i) => <tr key={i}><td>{t.name || '—'}</td><td className="num">{t.n}</td></tr>)}</tbody>
            </table>
          </div>
          )}
        </>
      )}

      <div className="acc-report-toolbar">
        <span className="acc-section-title" style={{ margin: 0 }}>Chi tiết bảo hành theo hợp đồng — bấm để xem thiết bị</span>
        {!isMobile && <button className="acc-export" onClick={onExport} disabled={!data.contracts.length}>⬇ Excel</button>}
      </div>
      {isMobile ? (
        <div className="acc-cards">
          {data.contracts.length === 0 && <p className="dash-empty">Chưa có thiết bị nào có ngày bảo hành.</p>}
          {data.contracts.map(c => {
            const isOpen = open === c.contract_out_id
            return (
              <AccCard key={c.contract_out_id}
                title={<span>{isOpen ? '▾ ' : '▸ '}<span className="mono">{c.contract_no}</span></span>}
                sub={c.customer_name}
                badge={<span className={`acc-status ${ST_CLASS[c.status] || ''}`}>{c.status}</span>}
                rowProps={contractCopy.getRowProps(c)}
                onClick={() => setOpen(isOpen ? null : c.contract_out_id)}
                rows={[
                  ['Số TB', c.device_count],
                  ['Còn hạn', c.valid_count],
                  ['Hết hạn', c.expired_count],
                  ['Hết BH sớm nhất', fmtDate(c.earliest_expiry)],
                  ['Hết BH muộn nhất', fmtDate(c.latest_expiry)],
                ]}>
                {isOpen && c.devices.length > 0 && (
                  <div className="acc-card-kids" onClick={(e) => e.stopPropagation()}>
                    {c.devices.map(d => (
                      <AccCard key={d.id}
                        title={d.name}
                        badge={<span className={`acc-status ${ST_CLASS[d.status] || ''}`}>{d.status}</span>}
                        onClick={() => goContract(c.contract_out_id, { tab: 'contract-warranty' })}
                        rows={[['Bảo hành', `${fmtDate(d.warranty_from)} → ${fmtDate(d.warranty_to)}`]]} />
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
            <th>Số HĐ</th><th>Khách hàng</th><th className="num">Số TB</th><th className="num">Còn hạn</th>
            <th className="num">Hết hạn</th><th>Hết BH sớm nhất</th><th>Hết BH muộn nhất</th><th>Trạng thái</th>
          </tr></thead>
          <tbody>
            {data.contracts.map(c => {
              const isOpen = open === c.contract_out_id
              return (
                <Fragment key={c.contract_out_id}>
                  <tr className="acc-row-click" onClick={() => setOpen(isOpen ? null : c.contract_out_id)} {...contractCopy.getRowProps(c)}>
                    <td>{isOpen ? '▾ ' : '▸ '}<span className="mono">{c.contract_no}</span></td>
                    <td>{c.customer_name || '—'}</td>
                    <td className="num">{c.device_count}</td><td className="num">{c.valid_count}</td>
                    <td className="num">{c.expired_count}</td>
                    <td>{fmtDate(c.earliest_expiry)}</td><td>{fmtDate(c.latest_expiry)}</td>
                    <td><span className={`acc-status ${ST_CLASS[c.status] || ''}`}>{c.status}</span></td>
                  </tr>
                  {isOpen && c.devices.map(d => (
                    <tr key={d.id} className="acc-row-sub acc-row-link" title="Bấm để mở bảo hành của hợp đồng"
                        onClick={() => goContract(c.contract_out_id, { tab: 'contract-warranty' })}>
                      <td colSpan={2}>{d.name}</td>
                      <td colSpan={3}>BH: {fmtDate(d.warranty_from)} → {fmtDate(d.warranty_to)}</td>
                      <td colSpan={3}><span className={`acc-status ${ST_CLASS[d.status] || ''}`}>{d.status}</span></td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {data.contracts.length === 0 && <tr><td colSpan={8} className="dash-empty">Chưa có thiết bị nào có ngày bảo hành.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      <div className="acc-section-title" style={{ marginTop: 18 }}>Danh sách yêu cầu bảo hành</div>
      {isMobile ? (
        <div className="acc-cards">
          {data.cases.length === 0 && <p className="dash-empty">Chưa có yêu cầu bảo hành.</p>}
          {data.cases.map(c => (
            <AccCard key={c.id}
              title={<span className="mono">{c.case_no || c.id}</span>}
              sub={c.title}
              badge={<span className={`acc-status ${c.resolved ? 'st-paid' : 'st-in'}`}>{c.status}</span>}
              rowProps={caseCopy.getRowProps(c)}
              onClick={() => goContract(c.contract_out_id, { tab: 'contract-warranty' })}
              rows={[
                ['Số HĐ', c.contract_no],
                ['Người báo', c.reported_by],
                ['Ngày tiếp nhận', fmtDate(c.reported_date)],
                ['Ngày hoàn thành', fmtDate(c.resolved_date)],
              ]} />
          ))}
        </div>
      ) : (
      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead><tr><th>Mã phiếu</th><th>Số HĐ</th><th>Nội dung</th><th>Người báo</th><th>Ngày tiếp nhận</th><th>Ngày hoàn thành</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {data.cases.map(c => (
              <tr key={c.id} className="acc-row-link" title="Bấm để mở bảo hành của hợp đồng"
                  {...caseCopy.getRowProps(c)} onClick={() => goContract(c.contract_out_id, { tab: 'contract-warranty' })}>
                <td className="mono">{c.case_no || c.id}</td><td className="mono">{c.contract_no}</td>
                <td>{c.title}</td><td>{c.reported_by || '—'}</td>
                <td>{fmtDate(c.reported_date)}</td><td>{fmtDate(c.resolved_date)}</td>
                <td><span className={`acc-status ${c.resolved ? 'st-paid' : 'st-in'}`}>{c.status}</span></td>
              </tr>
            ))}
            {data.cases.length === 0 && <tr><td colSpan={7} className="dash-empty">Chưa có yêu cầu bảo hành.</td></tr>}
          </tbody>
        </table>
      </div>
      )}
      {contractCopy.copyMenu}
      {caseCopy.copyMenu}
    </div>
  )
}
