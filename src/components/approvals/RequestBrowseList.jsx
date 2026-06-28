import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useApprovalsBrowse, qk } from '../../lib/queries'
import useIsMobile from '../contracts/useIsMobile'
import RequestDetail from './RequestDetail'
import FormTypeFilter, { useFormTypeFilter } from './FormTypeFilter'
import { statusInfo } from './approvalUtils'

const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

function StatusBadge({ s }) {
  const info = statusInfo(s)
  return <span className={`status-badge ${info.cls}`}>{info.label}</span>
}

// Danh sách đơn CHỈ ĐỌC (bấm để mở chi tiết). Dùng cho "Sắp đến lượt tôi" và
// "Tôi theo dõi" — chỉ khác endpoint, tiêu đề, cột ngày và câu thông báo rỗng.
export default function RequestBrowseList({
  title, endpoint, emptyText, dateField = 'submitted_at', dateLabel = 'Ngày gửi',
}) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState(null)
  // Danh sách chỉ đọc (sắp đến lượt / theo dõi) qua TanStack Query theo endpoint.
  const { data: rows = [] } = useApprovalsBrowse(endpoint)
  const load = () => queryClient.invalidateQueries({ queryKey: qk.approvalsBrowse(endpoint) })
  const { formId, setFormId, options, filtered } = useFormTypeFilter(rows)

  return (
    <div>
      <div className="ab-section-head">
        <h2 className="section-title" style={{ margin: 0 }}>{title}</h2>
        <FormTypeFilter value={formId} onChange={setFormId} options={options} />
      </div>

      {rows.length === 0 && <p className="approval-empty">{emptyText}</p>}
      {rows.length > 0 && filtered.length === 0 && <p className="approval-empty">Không có đơn nào thuộc loại đã chọn.</p>}

      {!isMobile && filtered.length > 0 && (
        <table className="data-table ar-table">
          <thead>
            <tr><th>Loại đơn</th><th>Tiêu đề</th><th>Người gửi</th><th>Trạng thái</th><th>Bước hiện tại</th><th>{dateLabel}</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="ar-row-click" onClick={() => setOpenId(r.id)}>
                <td>{r.form_icon ? `${r.form_icon} ` : ''}{r.form_name}</td>
                <td className={r.deleted_at ? 'ar-deleted' : ''}>{r.title}</td>
                <td>{r.requester_name}</td>
                <td><StatusBadge s={r.status} />{r.deleted_at && <span className="status-badge status-cancelled" style={{ marginLeft: 4 }}>Đã xóa</span>}</td>
                <td>{r.status === 'pending' ? (r.current_step_name || '') : ''}</td>
                <td>{fmt(r[dateField])}</td>
                <td><button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setOpenId(r.id) }}>Xem</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isMobile && filtered.map(r => (
        <div key={r.id} className="ar-card" onClick={() => setOpenId(r.id)}>
          <div className="ar-card-top">
            <span className={`ar-card-title${r.deleted_at ? ' ar-deleted' : ''}`}>{r.form_icon ? `${r.form_icon} ` : ''}{r.title}</span>
            <StatusBadge s={r.status} />
          </div>
          <div className="ar-card-meta">
            <span>{r.requester_name}</span>
            <span>{fmt(r[dateField])}</span>
          </div>
        </div>
      ))}

      {openId && (
        <RequestDetail
          requestId={openId}
          currentUserId={user.id}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
