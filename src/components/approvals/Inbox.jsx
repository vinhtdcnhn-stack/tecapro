import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useApprovalsInbox, qk } from '../../lib/queries'
import useIsMobile from '../contracts/useIsMobile'
import RequestDetail from './RequestDetail'
import FormTypeFilter, { useFormTypeFilter } from './FormTypeFilter'

const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

// "Chờ tôi duyệt": các đơn đang chờ chính tôi xử lý ở bước hiện tại.
export default function Inbox() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState(null)
  // Danh sách "chờ tôi duyệt" qua TanStack Query; load() (sau khi xử lý đơn) = invalidate.
  const { data: rows = [] } = useApprovalsInbox()
  const load = () => queryClient.invalidateQueries({ queryKey: qk.approvalsInbox })
  const { formId, setFormId, options, filtered } = useFormTypeFilter(rows)

  return (
    <div>
      <div className="ab-section-head">
        <h2 className="section-title" style={{ margin: 0 }}>CHỜ TÔI DUYỆT</h2>
        <FormTypeFilter value={formId} onChange={setFormId} options={options} />
      </div>
      {rows.length === 0 && <p className="approval-empty">Không có đơn nào đang chờ bạn duyệt.</p>}
      {rows.length > 0 && filtered.length === 0 && <p className="approval-empty">Không có đơn nào thuộc loại đã chọn.</p>}

      {!isMobile && filtered.length > 0 && (
        <table className="data-table ar-table">
          <thead>
            <tr><th>Loại đơn</th><th>Tiêu đề</th><th>Người gửi</th><th>Bước</th><th>Ngày gửi</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="ar-row-click" onClick={() => setOpenId(r.id)}>
                <td>{r.form_icon ? `${r.form_icon} ` : ''}{r.form_name}</td>
                <td>{r.title}</td>
                <td>{r.requester_name}</td>
                <td>{r.current_step_name}</td>
                <td>{fmt(r.submitted_at)}</td>
                <td><button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setOpenId(r.id) }}>Xử lý</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isMobile && filtered.map(r => (
        <div key={r.id} className="ar-card" onClick={() => setOpenId(r.id)}>
          <div className="ar-card-top">
            <span className="ar-card-title">{r.form_icon ? `${r.form_icon} ` : ''}{r.title}</span>
            <span className="status-badge status-pending">{r.current_step_name}</span>
          </div>
          <div className="ar-card-meta">
            <span>{r.requester_name}</span>
            <span>{fmt(r.submitted_at)}</span>
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
