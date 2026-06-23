import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { fmtMoney } from './tenderUtils'

// Trang Báo cáo Đấu thầu: thống kê theo kết quả / lĩnh vực / tháng, hiệu suất người
// làm thầu, đóng góp phòng ban. Lọc theo khoảng ngày nộp + xuất Excel.
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

export default function TenderReports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    fetch(`${API}/tender/reports?${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [from, to])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() async: setState sau await
  useEffect(load, [load])

  async function exportExcel() {
    if (!data) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const t = data.totals || {}
    const sumAoa = [
      ['Chỉ tiêu', 'Giá trị'],
      ['Tổng số gói', t.total], ['Trúng', t.won], ['Trượt', t.lost],
      ['Hủy', t.cancelled], ['Chưa có kết quả', t.pending],
      ['Tỷ lệ trúng (%)', pct(t.won, t.total)], ['Tổng dự toán (quy đổi VNĐ)', t.total_estimate],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumAoa), 'Tổng quan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['Lĩnh vực', 'Số gói', 'Dự toán (quy đổi VNĐ)'], ...data.byField.map(r => [r.field, r.count, r.estimate])]), 'Theo lĩnh vực')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['Tháng', 'Số gói', 'Trúng', 'Dự toán (quy đổi VNĐ)'], ...data.byMonth.map(r => [r.month, r.count, r.won, r.estimate])]), 'Theo tháng')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['Người làm thầu', 'Số gói', 'Trúng', 'Tỷ lệ %', 'Vòng review'],
        ...data.staff.map(r => [r.full_name, r.total, r.won, pct(r.won, r.total), r.review_rounds])]), 'Hiệu suất NV')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
      [['Phòng ban', 'Đầu việc', 'Hoàn thành', 'Đúng hạn'],
        ...data.dept.map(r => [r.department, r.items, r.done, r.on_time])]), 'Phòng ban')
    XLSX.writeFile(wb, `bao-cao-dau-thau-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const t = data?.totals
  return (
    <div className="tender-reports">
      <div className="tender-toolbar">
        <label className="tender-rep-filter">Từ ngày nộp
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="tender-rep-filter">Đến
          <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="tender-toolbar-spacer" />
        <button className="btn-secondary" onClick={exportExcel} disabled={!data}>Xuất Excel</button>
      </div>

      {loading ? <p className="dash-empty">Đang tải…</p> : !data ? <p className="dash-empty">Không có dữ liệu.</p> : (
        <>
          <div className="tender-cards">
            <div className="tender-card"><div className="tender-card-value">{t.total}</div><div className="tender-card-label">Tổng số gói</div></div>
            <div className="tender-card"><div className="tender-card-value" style={{ color: '#15803d' }}>{t.won}</div><div className="tender-card-label">Trúng ({pct(t.won, t.total)}%)</div></div>
            <div className="tender-card"><div className="tender-card-value" style={{ color: '#b91c1c' }}>{t.lost}</div><div className="tender-card-label">Trượt</div></div>
            <div className="tender-card"><div className="tender-card-value" style={{ color: '#64748b' }}>{t.cancelled + t.pending}</div><div className="tender-card-label">Hủy/Chưa có KQ</div></div>
          </div>

          <div className="tender-rep-grid">
            <ReportTable title="Theo lĩnh vực" head={['Lĩnh vực', 'Số gói', 'Dự toán (quy đổi VNĐ)']}
              rows={data.byField.map(r => [r.field, r.count, `${fmtMoney(r.estimate)} đ`])} />
            <ReportTable title="Theo tháng" head={['Tháng', 'Số gói', 'Trúng', 'Dự toán (quy đổi VNĐ)']}
              rows={data.byMonth.map(r => [r.month, r.count, r.won, `${fmtMoney(r.estimate)} đ`])} />
            <ReportTable title="Hiệu suất người làm thầu" head={['Người', 'Số gói', 'Trúng', 'Tỷ lệ', 'Vòng review']}
              rows={data.staff.map(r => [r.full_name, r.total, r.won, `${pct(r.won, r.total)}%`, r.review_rounds])} />
            <ReportTable title="Đóng góp phòng ban" head={['Phòng ban', 'Đầu việc', 'Hoàn thành', 'Đúng hạn']}
              rows={data.dept.map(r => [r.department, r.items, r.done, r.on_time])} />
          </div>
        </>
      )}
    </div>
  )
}

function ReportTable({ title, head, rows }) {
  return (
    <section className="tender-rep-section">
      <h3>{title}</h3>
      {!rows.length ? <p className="tender-muted">Không có dữ liệu.</p> : (
        <table className="tender-rep-table">
          <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      )}
    </section>
  )
}
