import { useState, useEffect } from 'react'
import { API_BASE as API } from '../../config/api'
import { fmtMoney, fmtDate, exportTable } from './reportUtils'
import './Accounting.css'

const CAT_CLASS = {
  'Đúng hạn': 'cat-ok', 'Từ 0-3 tháng': 'cat-1', 'Từ 3-6 tháng': 'cat-2',
  'Từ 6-9 tháng': 'cat-3', 'Trên 9 tháng': 'cat-4',
}

// #6 — Tổng kết tiến độ thu (số ngày chậm theo mốc bị nợ lâu nhất).
export default function ProgressCollectionPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

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
  ], rows)

  return (
    <div className="acc-report">
      <div className="acc-report-toolbar">
        <button className="acc-export" onClick={onExport} disabled={!rows.length}>⬇ Excel</button>
        <span className="acc-report-total">{rows.length} hợp đồng</span>
      </div>

      {loading ? <p className="dash-empty">Đang tải...</p>
        : rows.length === 0 ? <p className="dash-empty">Chưa có dữ liệu.</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Số HĐ</th><th>CĐT</th><th>Dự án</th><th>Ngày ký</th>
              <th className="num">Giá trị HĐ</th><th className="num">Đã thu</th><th className="num">Còn phải thu</th>
              <th className="num">Số ngày chậm</th><th>Phân loại</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.contract_out_id}>
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
    </div>
  )
}
