import { useState, useEffect } from 'react'
import { apiGet } from '../../lib/api'

// Tab "Lịch sử": nhật ký thao tác trên gói thầu (audit trail).
const ACTION_LABEL = {
  create: 'Tạo gói', assign: 'Phân công', status: 'Đổi trạng thái',
  update: 'Cập nhật', delete: 'Xoá',
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('vi-VN')
}

export default function TenderActivityTab({ tenderId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
    setLoading(true)
    apiGet(`/tender/${tenderId}/activity`, { conditional: true })
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [tenderId])

  if (loading) return <p className="dash-empty">Đang tải…</p>
  if (!rows.length) return <p className="dash-empty">Chưa có hoạt động nào.</p>

  return (
    <ul className="tender-activity">
      {rows.map(r => (
        <li key={r.id} className="tender-activity-item">
          <span className="tender-activity-action">{ACTION_LABEL[r.action] || r.action}</span>
          <span className="tender-activity-detail">{r.detail}</span>
          <span className="tender-activity-meta">{r.user_name || '—'} · {fmtTime(r.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
