import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { useAssignedTasks, qk } from '../lib/queries'
import TrackingTable from './TrackingTable'
import './Dashboard.css'
import './PMDashboard.css'

// Dashboard cho người dùng KHÔNG tham gia dự án nào: chỉ hiển thị các công việc
// được giao trực tiếp cho họ (contract_task.assigned_to), dùng cùng bảng + chuông/
// ghim/nhắc như bảng dưới của PMDashboard. windowDays=Infinity → hiện mọi việc được
// giao (không giới hạn 30 ngày) để họ thấy đầy đủ đầu việc của mình.
export default function AssigneeDashboard({ user, switcher = null }) {
  const queryClient = useQueryClient()
  const { data, isLoading: loading } = useAssignedTasks(user?.id)
  const items = Array.isArray(data?.items) ? data.items : []

  // Lưu ghim/nhắc: cập nhật LẠC QUAN trong cache, lỗi thì tải lại.
  const saveTracking = async (it, patch) => {
    const next = { ...it, ...patch }
    const key = qk.assignedTasks(user.id)
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

  if (loading) return <div className="dashboard"><p className="dash-empty">Đang tải công việc...</p></div>

  return (
    <div className="dashboard pm-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Công việc của tôi</h1>
          <p className="dash-subtitle">{switcher}Xin chào <strong>{user?.full_name || user?.email}</strong> — các công việc bạn được phân công xử lý</p>
        </div>
      </div>

      <TrackingTable
        items={items}
        onSaveTracking={saveTracking}
        windowDays={Infinity}
        title={<>Công việc được giao</>}
        emptyMessage="Bạn chưa có công việc được phân công."
      />
    </div>
  )
}
