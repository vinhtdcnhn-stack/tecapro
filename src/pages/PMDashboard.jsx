import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { usePmDashboard, qk } from '../lib/queries'
import TrackingTable from './TrackingTable'
import { fmtVnd, fmtUsd, WINDOW_DAYS } from './trackingUtils'
import './Dashboard.css'
import './PMDashboard.css'

export default function PMDashboard({ user, switcher = null }) {
  const queryClient = useQueryClient()
  // Bảng theo dõi qua TanStack Query: bấm qua lại giữa các dashboard không tải lại.
  const { data, isLoading: loading } = usePmDashboard(user?.id)
  const summary = data?.summary || null
  const items = Array.isArray(data?.items) ? data.items : []

  // Lưu ghim/nhắc: cập nhật LẠC QUAN ngay trong cache (UI phản hồi tức thì), lỗi thì tải lại.
  const saveTracking = async (it, patch) => {
    const next = { ...it, ...patch }
    const key = qk.pmDashboard(user.id)
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

  if (loading) return <div className="dashboard"><p className="dash-empty">Đang tải bảng theo dõi...</p></div>

  const s = summary || { contractCount: 0, totalVnd: 0, totalUsd: 0, upcomingCount: 0 }

  return (
    <div className="dashboard pm-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Bảng theo dõi tiến độ dự án</h1>
          <p className="dash-subtitle">{switcher}Xin chào <strong>{user?.full_name || user?.email}</strong> — các mốc thời hạn cần theo sát</p>
        </div>
      </div>

      {/* Phần trên: ô tổng quan */}
      <div className="dash-stats pm-stats">
        <StatCard label="Hợp đồng của tôi" value={s.contractCount}        color="var(--brand)" icon="📋" />
        <StatCard label="Tổng giá trị (VNĐ)" value={`${fmtVnd(s.totalVnd)} đ`} color="#2563eb" icon="💰" />
        <StatCard label="Tổng giá trị (USD)" value={`${fmtUsd(s.totalUsd)} $`} color="#7c3aed" icon="💵" />
        <StatCard label="Mốc sắp đến hạn (≤7 ngày)" value={s.upcomingCount} color="#d97706" icon="⏰" />
      </div>

      {/* Phần dưới: bảng theo dõi & nhắc việc */}
      <TrackingTable
        items={items}
        onSaveTracking={saveTracking}
        windowDays={WINDOW_DAYS}
        title={<>Mốc thời hạn<span className="pm-title-full"> cần theo dõi</span></>}
        emptyMessage="Chưa có mốc thời hạn nào cần theo dõi."
      />
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="dash-stat-card" style={{ borderTopColor: color }}>
      <div className="dash-stat-icon" style={{ color }}>{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  )
}
