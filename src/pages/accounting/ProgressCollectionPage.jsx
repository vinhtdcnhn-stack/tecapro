import { useState, useEffect, useMemo } from 'react'
import { API_BASE as API } from '../../config/api'
import { fmtMoney, fmtDate, exportTable, useContractNav } from './reportUtils'
import { useCopyMenu } from '../../components/common/useCopyMenu.jsx'
import { contractPath } from '../../components/common/deepLink'
import NumberInput from '../../components/common/NumberInput.jsx'
import './Accounting.css'

const CAT_CLASS = {
  'Đúng hạn': 'cat-ok', 'Từ 0-3 tháng': 'cat-1', 'Từ 3-6 tháng': 'cat-2',
  'Từ 6-9 tháng': 'cat-3', 'Trên 9 tháng': 'cat-4',
}

// Text dán chat: tiến độ thu của một hợp đồng.
function buildCopyText(r) {
  const crumbs = [r.contract_no ? `HĐ ${r.contract_no}` : null, r.project_name, r.customer_name].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Giá trị: ${fmtMoney(r.value_vnd)} đ, Đã thu: ${fmtMoney(r.collected_vnd)} đ, `
    + `Còn phải thu: ${fmtMoney(r.remaining_vnd)} đ${r.delay_days > 0 ? `, chậm ${r.delay_days} ngày` : ''} (${r.category || ''})`
}

// #6 — Tổng kết tiến độ thu (số ngày chậm theo mốc bị nợ lâu nhất).
export default function ProgressCollectionPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [minRemaining, setMinRemaining] = useState('')   // lọc: Còn phải thu > minRemaining
  const [maxRemaining, setMaxRemaining] = useState('')   // lọc: Còn phải thu ≤ maxRemaining
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.contract_no || r.project_name || 'Hợp đồng',
    (r) => contractPath(r.contract_out_id, { tab: 'contract-debt' }))
  const goContract = useContractNav()

  // Lọc theo cột "Còn phải thu": lớn hơn min (>) và/hoặc nhỏ hơn hoặc bằng max (≤).
  const filtered = useMemo(() => {
    const min = minRemaining === '' ? null : parseFloat(minRemaining)
    const max = maxRemaining === '' ? null : parseFloat(maxRemaining)
    return rows.filter(r => {
      const v = Number(r.remaining_vnd) || 0
      if (min != null && !Number.isNaN(min) && !(v > min)) return false
      if (max != null && !Number.isNaN(max) && !(v <= max)) return false
      return true
    })
  }, [rows, minRemaining, maxRemaining])

  useEffect(() => {
    let alive = true
    fetch(`${API}/api/reports/progress-collection`)
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { if (alive) { setRows(Array.isArray(d.rows) ? d.rows : []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const onExport = () => exportTable('Tong-ket-tien-do-thu.xlsx', 'Tien do thu', [
    { label: 'Số HĐ', value: r => r.contract_no }, { label: 'CĐT', value: r => r.customer_name },
    { label: 'Dự án', value: r => r.project_name }, { label: 'Ngày ký', value: r => fmtDate(r.contract_date) },
    { label: 'Giá trị HĐ (VNĐ)', value: r => Math.round(r.value_vnd) },
    { label: 'Đã thu (VNĐ)', value: r => Math.round(r.collected_vnd) },
    { label: 'Còn phải thu (VNĐ)', value: r => Math.round(r.remaining_vnd) },
    { label: 'Số ngày chậm', value: r => r.delay_days }, { label: 'Phân loại', value: r => r.category },
  ], filtered)

  const hasFilter = minRemaining !== '' || maxRemaining !== ''

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar" style={{ alignItems: 'flex-end' }}>
        <button className="acc-export" onClick={onExport} disabled={!filtered.length}>⬇ Excel</button>
        <label className="acc-field">Còn phải thu &gt;
          <NumberInput integer value={minRemaining} onChange={setMinRemaining} placeholder="0" style={{ width: 130 }} />
        </label>
        <label className="acc-field">Còn phải thu ≤
          <NumberInput integer value={maxRemaining} onChange={setMaxRemaining} placeholder="∞" style={{ width: 130 }} />
        </label>
        {hasFilter && (
          <button type="button" className="acc-export"
            onClick={() => { setMinRemaining(''); setMaxRemaining('') }}>Xoá lọc</button>
        )}
        <span className="acc-report-total">{filtered.length} hợp đồng{hasFilter ? ` / ${rows.length}` : ''}</span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">Chưa có dữ liệu.</p>
        : filtered.length === 0 ? <p className="dash-empty">Không có hợp đồng nào khớp bộ lọc.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Số HĐ</th><th>CĐT</th><th>Dự án</th><th>Ngày ký</th>
              <th className="num">Giá trị HĐ</th><th className="num">Đã thu</th><th className="num">Còn phải thu</th>
              <th className="num">Số ngày chậm</th><th>Phân loại</th>
            </tr></thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.contract_out_id} className="acc-row-link" title="Bấm để mở công nợ phải thu của hợp đồng"
                    {...getRowProps(r)} onClick={() => goContract(r.contract_out_id, { tab: 'contract-debt' })}>
                  <td>{i + 1}</td><td className="mono">{r.contract_no}</td><td>{r.customer_name || '—'}</td>
                  <td>{r.project_name || '—'}</td><td>{fmtDate(r.contract_date)}</td>
                  <td className="num">{fmtMoney(r.value_vnd)}</td>
                  <td className="num">{fmtMoney(r.collected_vnd)}</td>
                  <td className="num">{fmtMoney(r.remaining_vnd)}</td>
                  <td className="num">{r.delay_days > 0 ? r.delay_days : '—'}</td>
                  <td><span className={`acc-cat ${CAT_CLASS[r.category] || ''}`}>{r.category}</span></td>
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
