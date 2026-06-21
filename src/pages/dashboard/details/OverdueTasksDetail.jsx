import { fmtDate } from '../../accounting/reportUtils.js'
import { useCopyMenu } from '../../../components/common/useCopyMenu.jsx'

// Nhóm số ngày trễ → class tô màu (tái dùng thang nhóm nợ).
const tierOf = (d) => d <= 7 ? 'tier-1' : d <= 15 ? 'tier-2' : d <= 30 ? 'tier-3' : 'tier-4'

// Đoạn text dán vào chat hỏi tình trạng việc quá hạn.
function buildCopyText(r) {
  const crumbs = []
  if (r.contract_no) crumbs.push(`HĐ ${r.contract_no}`)
  if (r.customer_name) crumbs.push(r.customer_name)
  crumbs.push(r.title || 'Công việc')
  const meta = [r.department_name, r.assigned_to_name && `phụ trách ${r.assigned_to_name}`].filter(Boolean)
  return `📌 ${crumbs.join(' › ')} — Hạn: ${fmtDate(r.due_date)} (quá hạn ${r.days_overdue} ngày)`
    + (meta.length ? `, ${meta.join(', ')}` : '') + `, ${r.status || ''}`
}

// Chi tiết thẻ "Công việc quá hạn": bảng task quá hạn toàn hệ thống.
export default function OverdueTasksDetail({ overdueTasks, onOpenContract }) {
  const rows = overdueTasks?.rows || []
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText)

  return (
    <div className="exec-detail">
      <div className="exec-chip-row">
        <div className="exec-chip exec-chip--danger"><div className="exec-chip-lbl">Tổng việc quá hạn</div>
          <div className="exec-chip-val">{rows.length}</div></div>
      </div>

      {rows.length === 0 ? <p className="dash-empty">Không có công việc quá hạn. 🎉</p> : (
        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead><tr>
              <th>STT</th><th>Công việc</th><th>Số HĐ</th><th>Chủ đầu tư</th>
              <th>Bộ phận</th><th>Người phụ trách</th><th>Hạn</th><th className="num">Quá hạn</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="exec-row" onClick={() => onOpenContract(r.contract_out_id, 'contract-tasks')} {...getRowProps(r)}>
                  <td>{i + 1}</td>
                  <td>{r.title || '—'}</td>
                  <td className="mono">{r.contract_no || '—'}</td>
                  <td>{r.customer_name || '—'}</td>
                  <td>{r.department_name || '—'}</td>
                  <td>{r.assigned_to_name || '—'}</td>
                  <td>{fmtDate(r.due_date)}</td>
                  <td className="num"><span className={`acc-tier ${tierOf(r.days_overdue)}`}>{r.days_overdue} ngày</span></td>
                  <td>{r.status || '—'}</td>
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
