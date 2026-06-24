import { useState, useEffect, useCallback } from 'react'
import { API_BASE as API } from '../config/api'
import TrackingTable from './TrackingTable'
import './Dashboard.css'
import './PMDashboard.css'

// Dashboard cho Trưởng/Phó phòng: gom HẾT công việc từ mọi module (việc HĐ, việc nội
// bộ phòng, đầu việc đấu thầu) phân công cho nhân sự thuộc phòng. Việc nhiều người
// cùng làm đã được backend gộp về một dòng (cột "Người thực hiện" liệt kê đủ người).
// Tái dùng TrackingTable + ghim/nhắc (pm_dashboard_tracking theo userId người xem).
export default function DeptWorkDashboard({ user, switcher = null }) {
  const [items, setItems]     = useState([])
  const [summary, setSummary] = useState({ taskCount: 0, memberCount: 0, upcomingCount: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const res  = await fetch(`${API}/api/dept/${user.id}/work-dashboard`)
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      if (data.summary) setSummary(data.summary)
    } catch (e) { console.error('load dept work dashboard:', e) }
    finally { setLoading(false) }
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // Lưu ghim/nhắc (dùng chung endpoint tracking) rồi cập nhật cục bộ
  const saveTracking = async (it, patch) => {
    const next = { ...it, ...patch }
    setItems(prev => prev.map(x => (x.source_type === it.source_type && x.source_id === it.source_id) ? next : x))
    try {
      await fetch(`${API}/api/pm/${user.id}/tracking`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: it.source_type, source_id: it.source_id,
          pinned: next.pinned, remind_at: next.remind_at || null,
        }),
      })
    } catch (e) { console.error('saveTracking:', e); load() }
  }

  if (loading) return <div className="dashboard"><p className="dash-empty">Đang tải công việc của phòng...</p></div>

  return (
    <div className="dashboard pm-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Công việc của phòng</h1>
          <p className="dash-subtitle">{switcher}Toàn bộ công việc phân công cho nhân sự phòng — <strong>{summary.taskCount}</strong> việc · <strong>{summary.memberCount}</strong> nhân sự · <strong>{summary.upcomingCount}</strong> đến hạn trong 7 ngày</p>
        </div>
      </div>

      <TrackingTable
        items={items}
        onSaveTracking={saveTracking}
        windowDays={Infinity}
        title={<>Công việc phân công cho phòng</>}
        emptyMessage="Phòng chưa có công việc nào được phân công."
      />
    </div>
  )
}
