import { useNavigate } from 'react-router-dom'
import { fmtDate } from '../../accounting/reportUtils.js'
import { fmtCompact, fmtFull } from '../execUtils.js'

// Badge màu cho kết quả gói thầu.
const resultBadge = (r) =>
  r === 'Trúng' ? 'status-completed' : r === 'Trượt' ? 'status-cancelled'
    : r === 'Hủy' ? 'status-cancelled' : 'status-pending'

// Chi tiết chung cho 4 thẻ Đấu thầu: bảng danh sách gói; bấm dòng → mở gói thầu.
// variant: 'estimate' (dự toán) | 'result' (kết quả) | 'due' (số ngày còn lại).
export default function TenderListDetail({ rows = [], variant = 'estimate', onClose }) {
  const navigate = useNavigate()
  const open = (id) => { onClose?.(); navigate(`/cong-viec/dau-thau/goi/${id}`) }
  const totalVnd = rows.reduce((s, r) => s + Number(r.estimate_vnd || 0), 0)

  if (rows.length === 0) return <p className="dash-empty">Không có gói thầu nào.</p>

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip"><div className="exec-chip-lbl">Số gói</div>
          <div className="exec-chip-val">{rows.length}</div></div>
        {variant !== 'due' && (
          <div className="exec-chip"><div className="exec-chip-lbl">Tổng dự toán (VNĐ)</div>
            <div className="exec-chip-val" title={fmtFull(totalVnd)}>{fmtCompact(totalVnd)}</div></div>
        )}
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table">
          <thead><tr>
            <th>STT</th><th>Tên gói thầu</th><th>Chủ đầu tư</th>
            <th className="num">Dự toán (VNĐ)</th><th>Ngày nộp</th>
            {variant === 'result' ? <th>Kết quả</th>
              : variant === 'due' ? <th className="num">Còn lại</th>
                : <th>Trạng thái</th>}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="exec-row" onClick={() => open(r.id)}>
                <td>{i + 1}</td>
                <td>{r.package_name || '—'}</td>
                <td>{r.investor || '—'}</td>
                <td className="num" title={fmtFull(r.estimate_vnd)}>{fmtCompact(r.estimate_vnd)}</td>
                <td>{r.submit_date ? fmtDate(r.submit_date) : '—'}</td>
                {variant === 'result'
                  ? <td><span className={`status-badge ${resultBadge(r.result)}`}>{r.result || '—'}</span></td>
                  : variant === 'due'
                    ? <td className="num">{Number(r.days_left)} ngày</td>
                    : <td>{r.workflow_status || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
