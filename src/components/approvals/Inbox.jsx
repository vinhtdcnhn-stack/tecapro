import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import useIsMobile from '../contracts/useIsMobile'
import RequestDetail from './RequestDetail'

const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

// "Chờ tôi duyệt": các đơn đang chờ chính tôi xử lý ở bước hiện tại.
export default function Inbox() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState([])
  const [openId, setOpenId] = useState(null)

  const load = useCallback(() => {
    fetch(`${API}/approvals/requests/inbox`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <h2 className="section-title">CHỜ TÔI DUYỆT</h2>
      {rows.length === 0 && <p className="approval-empty">Không có đơn nào đang chờ bạn duyệt.</p>}

      {!isMobile && rows.length > 0 && (
        <table className="data-table ar-table">
          <thead>
            <tr><th>Loại đơn</th><th>Tiêu đề</th><th>Người gửi</th><th>Bước</th><th>Ngày gửi</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
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

      {isMobile && rows.map(r => (
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
