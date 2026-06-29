import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { useUnreadInbox, qk } from '../lib/queries'
import TrackingTable from './TrackingTable'
import './Dashboard.css'
import './PMDashboard.css'

// Hộp thư "Chưa đọc": gom MỌI việc (HĐ + phòng) có nội dung dòng thời gian chưa đọc với
// người xem vào một chỗ để theo dõi nhanh. Dùng chung TrackingTable (mỗi dòng nền hổ
// phách + chấm đếm chưa đọc, bấm vào mở thẳng việc → tự đánh dấu đã đọc → rời danh sách
// ở lần tải sau). windowDays=Infinity để hiện cả việc không có hạn.
export default function UnreadDashboard({ user, switcher = null }) {
  const queryClient = useQueryClient()
  const { data, isLoading: loading } = useUnreadInbox(user?.id)
  const items = Array.isArray(data?.items) ? data.items : []

  // Lưu ghim/nhắc: cập nhật LẠC QUAN trong cache, lỗi thì tải lại.
  const saveTracking = async (it, patch) => {
    const next = { ...it, ...patch }
    const key = qk.unreadInbox(user.id)
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

  if (loading) return <div className="dashboard"><p className="dash-empty">Đang tải mục chưa đọc...</p></div>

  return (
    <div className="dashboard pm-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Chưa đọc</h1>
          <p className="dash-subtitle">{switcher}Xin chào <strong>{user?.full_name || user?.email}</strong> — mọi việc có nội dung trao đổi bạn chưa xem</p>
        </div>
      </div>

      <TrackingTable
        items={items}
        onSaveTracking={saveTracking}
        windowDays={Infinity}
        title={<>Việc có nội dung chưa đọc</>}
        emptyMessage="Bạn đã đọc hết — không còn nội dung nào chưa xem. 🎉"
      />
    </div>
  )
}
