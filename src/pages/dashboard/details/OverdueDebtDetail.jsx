import { useState, useEffect } from 'react'
import { API } from '../../../config/api.js'
import { fmtFull } from '../execUtils.js'
import { fmtMoney, fmtDate, TIER_CLASS } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../../components/common/deepLink'

// Đoạn text dán vào chat hỏi tình trạng khoản nợ quá hạn.
function buildCopyText(r) {
  const crumbs = []
  if (r.contract_no) crumbs.push(`HĐ ${r.contract_no}`)
  if (r.customer_name) crumbs.push(r.customer_name)
  if (r.description) crumbs.push(r.description)
  return `📌 ${crumbs.join(' › ')} — Còn nợ: ${fmtMoney(r.remaining_vnd)} đ, `
    + `Hạn TT: ${fmtDate(r.due_date)} (quá hạn ${r.days_overdue} ngày, ${r.tier_label || ''})`
}

// Chi tiết thẻ "Nợ quá hạn": tải lười danh sách khoản nợ quá hạn, nhóm theo số ngày.
export default function OverdueDebtDetail({ asOf = null, onOpenContract }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.description || r.contract_no || 'Khoản nợ',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-debt' }))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const aq = asOf ? `&asOf=${asOf}` : ''
        const res = await fetch(`${API}/reports/overdue-receivables?basis=actual${aq}`)
        const data = await res.json()
        if (!cancelled) setRows((Array.isArray(data.rows) ? data.rows : []).filter(r => r.days_overdue > 0))
      } catch (e) { console.error('overdue-receivables:', e) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [asOf])

  const totalVnd = rows.reduce((s, r) => s + (parseFloat(r.remaining_vnd) || 0), 0)

  if (loading) return <p className="dash-empty">Đang tải khoản nợ quá hạn...</p>

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip exec-chip--danger"><div className="exec-chip-lbl">Tổng nợ quá hạn</div>
          <div className="exec-chip-val" title={fmtFull(totalVnd)}>{fmtMoney(totalVnd)} đ</div></div>
        <div className="exec-chip"><div className="exec-chip-lbl">Số khoản</div>
          <div className="exec-chip-val">{rows.length}</div></div>
      </div>

      {rows.length === 0 ? <p className="dash-empty">Không có khoản nợ quá hạn. 🎉</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Chủ đầu tư</th><th>Số HĐ</th><th>Nội dung</th>
              <th className="num">Còn nợ (VNĐ)</th><th>Hạn TT</th><th className="num">Quá hạn</th><th>Nhóm nợ</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-debt')} {...getRowProps(r)}>
                  <td>{i + 1}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.description || '—'}</td>
                  <td className="num" title={fmtFull(r.remaining_vnd)}>{fmtMoney(r.remaining_vnd)}</td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td className="num">{r.days_overdue} ngày</td>
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
