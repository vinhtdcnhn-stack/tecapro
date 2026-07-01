import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenders } from '../lib/queries'
import { statusColor, fmtDate, fmtMoney, daysUntil } from '../components/tender/tenderUtils'
import '../components/tender/Tender.css'

// Dashboard trang chủ cho thành viên Ban Kế hoạch Đấu thầu.
// Thẻ tổng quan + danh sách gói sắp đến hạn nộp + "Việc của tôi".
export default function TenderDashboard({ switcher, user }) {
  const navigate = useNavigate()
  // Dùng chung cache với danh sách Đấu thầu (TenderList) → vào module là có ngay, ngược lại.
  const { data: all = [] } = useTenders('all')
  const { data: mine = [] } = useTenders('my')

  const stats = useMemo(() => {
    const active = all.filter(t => ['Lập checklist', 'Đang thực hiện'].includes(t.workflow_status))
    const review = all.filter(t => t.workflow_status === 'Chờ review')
    const fixing = all.filter(t => t.workflow_status === 'Chưa đạt')
    const ready = all.filter(t => t.workflow_status === 'Sẵn sàng in/ký')
    const dueSoon = all.filter(t => {
      const d = daysUntil(t.submit_date)
      return d != null && d >= 0 && d <= 7 && !t.result
    }).sort((a, b) => new Date(a.submit_date) - new Date(b.submit_date))
    return { active, review, fixing, ready, dueSoon }
  }, [all])

  const open = (t) => navigate(`/cong-viec/dau-thau/goi/${t.id}`)

  const CARDS = [
    { label: 'Đang thực hiện', value: stats.active.length, color: '#a16207' },
    { label: 'Chờ review', value: stats.review.length, color: '#c2410c' },
    { label: 'Chờ sửa', value: stats.fixing.length, color: '#b91c1c' },
    { label: 'Sẵn sàng in/ký', value: stats.ready.length, color: '#1d4ed8' },
  ]

  return (
    <div className="dashboard tender-dash">
      <div className="dash-head">
        <div>
          <h2 className="dash-title">Kế hoạch Đấu thầu — Tổng quan</h2>
          <p className="dash-sub">{switcher}Xin chào <strong>{user?.full_name}</strong> — theo dõi gói thầu & việc cần xử lý</p>
        </div>
      </div>

      <div className="tender-cards">
        {CARDS.map(c => (
          <div key={c.label} className="tender-card">
            <div className="tender-card-value" style={{ color: c.color }}>{c.value}</div>
            <div className="tender-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="tender-dash-cols">
        <section className="tender-dash-section">
          <h3>⚠ Sắp đến hạn nộp (7 ngày)</h3>
          {!stats.dueSoon.length ? <p className="dash-empty">Không có gói nào sắp đến hạn.</p> : (
            <ul className="tender-dash-list">
              {stats.dueSoon.map(t => {
                const d = daysUntil(t.submit_date)
                return (
                  <li key={t.id} onClick={() => open(t)} className="tender-dash-row">
                    <span className="tender-dash-name">{t.package_name}</span>
                    <span className="tender-dash-due">{fmtDate(t.submit_date)} · còn {d} ngày</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="tender-dash-section">
          <h3>Việc của tôi</h3>
          {!mine.length ? <p className="dash-empty">Bạn chưa phụ trách gói nào.</p> : (
            <ul className="tender-dash-list">
              {mine.map(t => {
                const sc = statusColor(t.workflow_status)
                return (
                  <li key={t.id} onClick={() => open(t)} className="tender-dash-row">
                    <span className="tender-dash-name">{t.package_name}</span>
                    <span className="tender-badge" style={{ background: sc.bg, color: sc.fg }}>{t.workflow_status}</span>
                    <span className="tender-dash-due">{fmtMoney(t.estimate)} đ</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
