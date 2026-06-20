import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../config/api'
import {
  fmtCompact, fmtFull, signedThisYearVnd, signedThisYearCount,
  loadDashRange, saveDashRange, dashQuery, filterByRange,
} from './dashboard/execUtils'
import DashRangePicker from './dashboard/DashRangePicker'
import DashAsOfPicker from './dashboard/DashAsOfPicker'
import ExecKpiCard from './dashboard/ExecKpiCard'
import ExecCardModal from './dashboard/ExecCardModal'
import PortfolioDetail from './dashboard/details/PortfolioDetail'
import CollectedDetail from './dashboard/details/CollectedDetail'
import OutstandingDetail from './dashboard/details/OutstandingDetail'
import OverdueDebtDetail from './dashboard/details/OverdueDebtDetail'
import OverdueTasksDetail from './dashboard/details/OverdueTasksDetail'
import RevenueDetail from './dashboard/details/RevenueDetail'
import CashflowMonthDetail from './dashboard/details/CashflowMonthDetail'
import MomentumDetail from './dashboard/details/MomentumDetail'
import { fmtDate } from './accounting/reportUtils'
import './Dashboard.css'

// Dashboard điều hành (Giám đốc/BGĐ): 8 thẻ KPI tiền & rủi ro xếp 4×2; bấm thẻ mở
// chi tiết full màn hình. Dữ liệu lấy từ module báo cáo tài chính (đã cho phép GD/PGD).
export default function Dashboard({ user, switcher = null, contracts = [] }) {
  const navigate = useNavigate()
  const [cashflow, setCashflow] = useState(null)
  const [byCustomer, setByCustomer] = useState(null)
  const [byContract, setByContract] = useState(null)
  const [overdueTasks, setOverdueTasks] = useState(null)
  // Danh sách HĐ dựng tại asOf (giá trị/ngày ký/trạng thái đúng quá khứ); null khi xem hiện tại.
  const [asOfContractList, setAsOfContractList] = useState(null)
  const [openCard, setOpenCard] = useState(null)
  const [range, setRange] = useState(loadDashRange)
  // asOf: xem dashboard tại 1 thời điểm trong quá khứ (null = hiện tại). Không lưu local.
  const [asOf, setAsOf] = useState(null)

  // Khoảng năm ký HĐ (lưu local) khống chế các thẻ lũy kế; asOf (1 lần) tính mọi số liệu
  // tới đúng ngày đó. Các thẻ theo tháng/năm hiện tại dùng tháng/năm của asOf nếu có.
  const changeRange = (r) => { setRange(r); saveDashRange(r) }

  useEffect(() => {
    let cancelled = false
    const get = (path) => fetch(`${API}${path}`).then(r => r.ok ? r.json() : null).catch(() => null)
    const rq = dashQuery(range, asOf)
    const q = rq ? `?${rq}` : ''
    // overdue-tasks chỉ nhận asOf (không lọc theo khoảng năm ký).
    const tq = asOf ? `?asOf=${asOf}` : ''
    ;(async () => {
      const [cf, bcu, bco, ot, cl] = await Promise.all([
        get(`/reports/cashflow-summary${tq}`),
        get(`/reports/debt-by-customer${q}`),
        get(`/reports/debt-by-contract${q}`),
        get(`/reports/overdue-tasks${tq}`),
        // Chỉ cần danh sách HĐ as-of khi xem quá khứ; hiện tại dùng prop `contracts` (live).
        asOf ? get(`/reports/contracts-asof?asOf=${asOf}`) : Promise.resolve(null),
      ])
      if (cancelled) return
      setCashflow(cf); setByCustomer(bcu); setByContract(bco); setOverdueTasks(ot)
      setAsOfContractList(cl?.rows || null)
    })()
    return () => { cancelled = true }
  }, [range, asOf])

  // Nguồn HĐ: khi xem quá khứ dùng danh sách dựng tại asOf (giá trị đúng quá khứ),
  // ngược lại dùng prop `contracts` (live). Khi asOf đã chọn nhưng chưa tải xong → rỗng.
  const srcContracts = useMemo(() => (asOf ? (asOfContractList || []) : contracts), [asOf, asOfContractList, contracts])

  // HĐ giới hạn theo khoảng năm + chỉ tính HĐ ký tới asOf (cho thẻ Tổng giá trị HĐ + chi tiết).
  const rangedContracts = useMemo(() => filterByRange(srcContracts, range, asOf), [srcContracts, range, asOf])

  // Mở hợp đồng tại đúng tab chứa nội dung (tab mặc định = thông tin HĐ).
  // extra: query phụ (vd { inId } để mở đúng HĐ nhập trong tab "Hợp đồng nhập").
  const openContract = (id, tab, extra) => {
    setOpenCard(null)
    const qs = new URLSearchParams()
    if (tab) qs.set('tab', tab)
    for (const [k, v] of Object.entries(extra || {})) if (v != null) qs.set(k, v)
    const s = qs.toString()
    navigate(s ? `/qlda/${id}?${s}` : `/qlda/${id}`)
  }

  // Giá trị KPI (— khi chưa có dữ liệu / không đủ quyền).
  const M = (n) => n == null ? '—' : fmtCompact(n)
  const T = (n) => n == null ? undefined : fmtFull(n)
  const portfolio = byContract?.totals?.value
  const collected = byCustomer?.totals?.total_paid
  const outstanding = byCustomer?.totals?.total_outstanding
  const overdueDebt = cashflow?.overdue_total_vnd
  const taskCount = overdueTasks?.count
  const revenueYtd = cashflow?.revenue_ytd
  const recvMonth = cashflow?.expected_receipt_month
  const payMonth = cashflow?.expected_payment_month
  const year = Number(cashflow?.year) || (asOf ? Number(asOf.slice(0, 4)) : new Date().getFullYear())
  // HĐ ký tới asOf (cho thẻ "ký năm Y" — chỉ tính HĐ ký trước/đến thời điểm xem).
  const asOfContracts = useMemo(() => filterByRange(srcContracts, {}, asOf), [srcContracts, asOf])
  const signedYear = signedThisYearVnd(asOfContracts, year)

  const cards = [
    {
      key: 'portfolio', icon: '📊', accent: '#2f6b3a', label: 'Tổng giá trị hợp đồng',
      value: M(portfolio), valueTitle: T(portfolio), sub: `${rangedContracts.length} hợp đồng`,
      title: 'Tổng giá trị hợp đồng',
      render: () => <PortfolioDetail contracts={rangedContracts} byContract={byContract} onOpenContract={openContract} />,
    },
    {
      key: 'collected', icon: '💰', accent: '#16a34a', label: 'Doanh thu đã thu',
      value: M(collected), valueTitle: T(collected),
      sub: byCustomer ? `Tỷ lệ thu ${Math.round((byCustomer.totals?.collection_ratio || 0) * 100)}%` : null,
      title: 'Doanh thu đã thu',
      render: () => <CollectedDetail byCustomer={byCustomer} />,
    },
    {
      key: 'outstanding', icon: '🧾', accent: '#2563eb', label: 'Công nợ phải thu',
      value: M(outstanding), valueTitle: T(outstanding),
      title: 'Công nợ phải thu',
      render: () => <OutstandingDetail byCustomer={byCustomer} byContract={byContract} onOpenContract={openContract} />,
    },
    {
      key: 'overdueDebt', icon: '⚠️', danger: true, label: 'Nợ quá hạn',
      value: M(overdueDebt), valueTitle: T(overdueDebt),
      sub: cashflow ? `${cashflow.overdue_count || 0} khoản` : null,
      title: 'Nợ quá hạn',
      render: () => <OverdueDebtDetail asOf={asOf} onOpenContract={openContract} />,
    },
    {
      key: 'overdueTasks', icon: '⏰', danger: true, label: 'Công việc quá hạn',
      value: taskCount == null ? '—' : String(taskCount),
      sub: 'công việc cần xử lý',
      title: 'Công việc quá hạn',
      render: () => <OverdueTasksDetail overdueTasks={overdueTasks} onOpenContract={openContract} />,
    },
    {
      key: 'revenue', icon: '📈', accent: '#0891b2', label: `Doanh thu xuất HĐ ${year}`,
      value: M(revenueYtd), valueTitle: T(revenueYtd),
      title: `Doanh thu xuất hóa đơn năm ${year}`,
      render: () => <RevenueDetail cashflow={cashflow} byContract={byContract} onOpenContract={openContract} />,
    },
    {
      key: 'cashflowMonth', icon: '🔁', accent: '#7c3aed', label: asOf ? 'Dự kiến thu / chi (tháng của ngày xem)' : 'Dự kiến thu / chi tháng này',
      value: cashflow ? `${fmtCompact(recvMonth)}` : '—',
      valueTitle: T(recvMonth),
      sub: cashflow ? `Chi dự kiến ${fmtCompact(payMonth)}` : null,
      title: 'Dự kiến thu / chi trong tháng',
      render: () => <CashflowMonthDetail asOf={asOf} onOpenContract={openContract} />,
    },
    {
      key: 'momentum', icon: '✍️', accent: '#d97706', label: `Giá trị HĐ ký năm ${year}`,
      value: fmtCompact(signedYear), valueTitle: fmtFull(signedYear),
      sub: `${signedThisYearCount(asOfContracts, year)} hợp đồng ký mới`,
      title: 'Đà ký hợp đồng',
      render: () => <MomentumDetail contracts={asOfContracts} />,
    },
  ]

  const open = cards.find(c => c.key === openCard)

  return (
    <div className="dashboard exec-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Tổng quan điều hành</h1>
          <p className="dash-subtitle">{switcher}Xin chào, <strong>{user?.full_name || user?.email}</strong> — {user?.department_name}</p>
          <p className="exec-asof">
            Số liệu cập nhật ngày {fmtDate(asOf || new Date())} · bấm vào từng thẻ để xem chi tiết
          </p>
        </div>
        <div className="dash-controls">
          <DashRangePicker range={range} onChange={changeRange} />
          <DashAsOfPicker asOf={asOf} onChange={setAsOf} />
        </div>
      </div>

      {asOf && (
        <div className="dash-asof-banner">
          🕐 Đang xem số liệu tại ngày <strong>{fmtDate(asOf)}</strong> (xem lại quá khứ)
          <button type="button" className="dash-asof-banner-btn" onClick={() => setAsOf(null)}>Về hiện tại</button>
        </div>
      )}

      <div className="exec-grid">
        {cards.map(c => (
          <ExecKpiCard
            key={c.key} icon={c.icon} label={c.label} value={c.value} valueTitle={c.valueTitle}
            sub={c.sub} accent={c.accent} danger={c.danger} onClick={() => setOpenCard(c.key)}
          />
        ))}
      </div>

      {open && (
        <ExecCardModal title={open.title} onClose={() => setOpenCard(null)}>
          {open.render()}
        </ExecCardModal>
      )}
    </div>
  )
}
