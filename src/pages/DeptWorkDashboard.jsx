import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { useDeptWorkDashboard, qk } from '../lib/queries'
import TrackingTable from './TrackingTable'
import './Dashboard.css'
import './PMDashboard.css'

// Dashboard cho Trưởng/Phó phòng: gom HẾT công việc từ mọi module (việc HĐ, việc nội
// bộ phòng, đầu việc đấu thầu) phân công cho nhân sự thuộc phòng. Việc nhiều người
// cùng làm đã được backend gộp về một dòng (cột "Người thực hiện" liệt kê đủ người).
// Tái dùng TrackingTable + ghim/nhắc (pm_dashboard_tracking theo userId người xem).
export default function DeptWorkDashboard({ user, switcher = null }) {
  const queryClient = useQueryClient()
  const { data, isLoading: loading } = useDeptWorkDashboard(user?.id)
  const items = Array.isArray(data?.items) ? data.items : []
  const summary = data?.summary || { taskCount: 0, memberCount: 0, upcomingCount: 0 }

  // Lưu ghim/nhắc: cập nhật LẠC QUAN trong cache, lỗi thì tải lại.
  const saveTracking = async (it, patch) => {
    const next = { ...it, ...patch }
    const key = qk.deptWorkDashboard(user.id)
    queryClient.setQueryData(key, (old) => old ? {
      ...old,
      items: (old.items || []).map(x => (x.source_type === it.source_type && x.source_id === it.source_id) ? next : x),
    } : old)
    try {
      await fetch(`${API}/api/pm/${user.id}/tracking`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: it.source_type, source_id: it.source_id,
          pinned: next.pinned, remind_at: next.remind_at || null,
        }),
      })
    } catch (e) { console.error('saveTracking:', e); queryClient.invalidateQueries({ queryKey: key }) }
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
