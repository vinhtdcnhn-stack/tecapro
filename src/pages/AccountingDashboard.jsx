import { useState } from 'react'
import { useCashflowSummary } from '../lib/queries'
import useIsMobile from '../components/contracts/useIsMobile'
import OverdueAlertsPage from './accounting/OverdueAlertsPage'
import ReceivablesReportPage from './accounting/ReceivablesReportPage'
import PayablesReportPage from './accounting/PayablesReportPage'
import ProgressCollectionPage from './accounting/ProgressCollectionPage'
import DebtSummaryPage from './accounting/DebtSummaryPage'
import WarrantyReportPage from './accounting/WarrantyReportPage'
import './Dashboard.css'
import './accounting/Accounting.css'

const fmtVnd = (n) => n == null ? '—' : (parseFloat(n) || 0).toLocaleString('vi-VN') + ' đ'

function StatCard({ label, value, color, hint }) {
  return (
    <div className="acc-stat-card" style={{ borderTopColor: color }}>
      <div className="acc-stat-value" style={{ color }}>{value}</div>
      <div className="acc-stat-label">{label}</div>
      {hint && <div className="acc-stat-hint">{hint}</div>}
    </div>
  )
}

// Tổng quan dòng tiền cho kế toán.
function Overview() {
  const { data: sum = null, isLoading: loading } = useCashflowSummary()

  if (loading) return <p className="dash-empty">Đang tải tổng quan dòng tiền...</p>
  if (!sum) return <p className="dash-empty">Không tải được dữ liệu.</p>

  return (
    <>
      <div className="acc-stats">
        <StatCard label={`Doanh thu xuất hóa đơn ${sum.year}`} value={fmtVnd(sum.revenue_ytd)} color="var(--brand)"
          hint={sum.revenue_ytd == null ? 'Sẽ có khi bật module Xuất hóa đơn' : 'Lũy kế từ đầu năm'} />
        <StatCard label="Dự kiến THU trong tháng" value={fmtVnd(sum.expected_receipt_month)} color="#2563eb"
          hint="Công nợ phải thu tới hạn (theo tiến độ thực) chưa thu" />
        <StatCard label="Dự kiến CHI trong tháng" value={fmtVnd(sum.expected_payment_month)} color="#d97706"
          hint="Phải trả NCC tới hạn chưa trả" />
        <StatCard label="Nợ quá hạn" value={fmtVnd(sum.overdue_total_vnd)} color="#dc2626"
          hint={`${sum.overdue_count} khoản đang quá hạn`} />
      </div>
    </>
  )
}

const TABS = [
  { key: 'overview',    label: 'Tổng quan' },
  { key: 'overdue',     label: 'Cảnh báo nợ quá hạn' },
  { key: 'receivables', label: 'Công nợ phải thu' },
  { key: 'payables',    label: 'Công nợ phải trả' },
  { key: 'progress',    label: 'Tổng kết tiến độ thu' },
  { key: 'debt',        label: 'Tổng hợp theo KH/HĐ' },
  { key: 'warranty',    label: 'Tình trạng bảo hành' },
]

function renderTab(tab) {
  switch (tab) {
    case 'overdue':     return <OverdueAlertsPage />
    case 'receivables': return <ReceivablesReportPage />
    case 'payables':    return <PayablesReportPage />
    case 'progress':    return <ProgressCollectionPage />
    case 'debt':        return <DebtSummaryPage />
    case 'warranty':    return <WarrantyReportPage />
    default:            return <Overview />
  }
}

const TAB_STORE_KEY = 'accounting_tab'

// Trang chủ kế toán: hub xem báo cáo (dashboard + sub-nav sang từng báo cáo).
export default function AccountingDashboard({ user, switcher = null }) {
  const isMobile = useIsMobile()
  // Nhớ tab đang xem qua localStorage để khi rời trang (vào HĐ chi tiết) rồi quay lại
  // bằng phím 'z' không bị nhảy về 'Tổng quan'.
  const [tab, setTab] = useState(() => {
    const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(TAB_STORE_KEY) : null
    return TABS.some(t => t.key === stored) ? stored : 'overview'
  })
  const pickTab = (key) => {
    setTab(key)
    try { localStorage.setItem(TAB_STORE_KEY, key) } catch { /* ignore */ }
  }

  return (
    <div className="dashboard acc-dashboard">
      {/* Mobile: bỏ hẳn tiêu đề + dòng chào cho gọn (đã có nút đổi bảng cạnh Đăng xuất) */}
      {!isMobile && (
        <div className="dash-welcome">
          <div>
            <h1 className="dash-title">Kế toán — Tổng quan tài chính</h1>
            <p className="dash-subtitle">{switcher}Xin chào <strong>{user?.full_name || user?.email}</strong> — theo dõi dòng tiền, công nợ & cảnh báo</p>
          </div>
        </div>
      )}

      {isMobile ? (
        <select className="acc-tab-select" value={tab} onChange={(e) => pickTab(e.target.value)} aria-label="Chọn báo cáo">
          {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      ) : (
        <div className="acc-subnav">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => pickTab(t.key)}>{t.label}</button>
          ))}
        </div>
      )}

      {renderTab(tab)}
    </div>
  )
}
