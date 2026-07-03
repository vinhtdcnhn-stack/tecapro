import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE as API } from '../config/api'
import { usePmDashboard, qk } from '../lib/queries'
import TrackingTable from './TrackingTable'
import { fmtVnd, fmtUsd, WINDOW_DAYS, dueInfo } from './trackingUtils'
import './Dashboard.css'
import './PMDashboard.css'

export default function PMDashboard({ user, switcher = null }) {
  const queryClient = useQueryClient()
  // Bảng theo dõi qua TanStack Query: bấm qua lại giữa các dashboard không tải lại.
  const { data, isLoading: loading } = usePmDashboard(user?.id)
  const summary = data?.summary || null
  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data])

  // Lọc bảng dưới theo trạng thái hạn khi bấm ô "Quá hạn" / "Sắp đến hạn".
  const [dueFilter, setDueFilter] = useState(null) // 'overdue' | 'upcoming' | null
  const tableRef = useRef(null)

  // Đếm mốc quá hạn (hạn < hôm nay) và sắp đến hạn (còn 0–7 ngày) ngay ở client để
  // số trên ô luôn khớp với số dòng bảng lọc được (ô "≤7 ngày" của server gộp cả quá hạn).
  const { overdueCount, upcomingCount } = useMemo(() => {
    let overdue = 0, upcoming = 0
    for (const it of items) {
      if (!it.due_date) continue
      const d = dueInfo(it.due_date).days
      if (d == null) continue
      if (d < 0) overdue++
      else if (d <= 7) upcoming++
    }
    return { overdueCount: overdue, upcomingCount: upcoming }
  }, [items])

  // Bấm ô: bật/tắt lọc + cuộn xuống bảng công việc tương ứng.
  const pickFilter = (kind) => {
    setDueFilter(prev => {
      const next = prev === kind ? null : kind
      if (next) requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return next
    })
  }

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
        <StatCard label="Mốc quá hạn" value={overdueCount} color="#dc2626" icon="⚠️"
          onClick={() => pickFilter('overdue')} active={dueFilter === 'overdue'} />
        <StatCard label="Mốc sắp đến hạn (≤7 ngày)" value={upcomingCount} color="#d97706" icon="⏰"
          onClick={() => pickFilter('upcoming')} active={dueFilter === 'upcoming'} />
      </div>

      {/* Phần dưới: bảng theo dõi & nhắc việc */}
      <div ref={tableRef}>
        <TrackingTable
          items={items}
          onSaveTracking={saveTracking}
          windowDays={WINDOW_DAYS}
          dueFilter={dueFilter}
          onClearDueFilter={() => setDueFilter(null)}
          title={<>Mốc thời hạn<span className="pm-title-full"> cần theo dõi</span></>}
          emptyMessage="Chưa có mốc thời hạn nào cần theo dõi."
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon, onClick, active }) {
  const clickable = typeof onClick === 'function'
  return (
    <div
      className={`dash-stat-card ${clickable ? 'clickable' : ''} ${active ? 'active' : ''}`}
      style={{ borderTopColor: color, ...(active ? { '--stat-active': color } : null) }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      title={clickable ? 'Bấm để lọc công việc bên dưới' : undefined}
    >
      <div className="dash-stat-icon" style={{ color }}>{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  )
}
