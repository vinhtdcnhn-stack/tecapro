import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE as API } from '../config/api'
import DateInput, { isoToDisplay } from '../components/contracts/DateInput'
import './Dashboard.css'
import './PMDashboard.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Chỉ hiển thị mốc đến hạn trong vòng N ngày tới (mốc quá hạn vẫn luôn hiện)
const WINDOW_DAYS = 30

const todayISO = () => new Date(new Date().toDateString()).toISOString().slice(0, 10)
const addDays = (isoDate, n) => { const d = new Date(isoDate); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000) // a - b
const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(parseFloat(n) || 0))
const fmtUsd = (n) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(parseFloat(n) || 0)

const KIND_META = {
  'Biên bản':     'kind-progress',
  'Công nợ':      'kind-receivable',
  'Bảo lãnh':     'kind-guarantee',
  'Công việc':    'kind-task',
  'Phải trả':     'kind-payable',
  'Nhận hàng':    'kind-delivery',
  'Logistics':    'kind-logistics',
  'Bảo hành NCC': 'kind-supwarranty',
}

// Ngày nhắc hiệu lực: do user đặt, hoặc mặc định = hạn − 7 ngày
const effRemind = (it) => it.remind_at || (it.due_date ? addDays(it.due_date, -7) : null)

// Mốc thuộc phía bán → menu sidebar của HĐ bán
const SELL_MENU = {
  progress:   'contract-progress',
  receivable: 'contract-debt',
  guarantee:  'contract-guarantee',
  task:       'contract-tasks',
}
// Mốc thuộc phía nhập → tab con trong chi tiết HĐ nhập
const IN_TAB = {
  in_progress:  'progress',
  in_payable:   'payment',
  in_delivery:  'delivery',
  in_customs:   'customs',
  in_guarantee: 'guarantee',
  in_warranty:  'warranty',
}

// Đường dẫn nhảy thẳng tới đúng trang chứa mốc việc được nhấn.
function targetUrl(it) {
  if (!it.contract_id) return null
  if (it.side === 'Nhập' && it.contract_in_id) {
    const inTab = IN_TAB[it.source_type] || 'info'
    return `/qlda/${it.contract_id}?tab=purchase-contract-info&inId=${it.contract_in_id}&inTab=${inTab}`
  }
  const menu = SELL_MENU[it.source_type]
  return menu ? `/qlda/${it.contract_id}?tab=${menu}` : `/qlda/${it.contract_id}`
}

function dueInfo(due) {
  if (!due) return { cls: 'due-normal', label: '—', days: null }
  const days = daysBetween(due, todayISO()) // còn lại
  if (days < 0)  return { cls: 'due-overdue', label: `Quá hạn ${Math.abs(days)} ngày`, days }
  if (days === 0) return { cls: 'due-overdue', label: 'Đến hạn hôm nay', days }
  if (days <= 7) return { cls: 'due-soon', label: `Còn ${days} ngày`, days }
  return { cls: 'due-normal', label: `Còn ${days} ngày`, days }
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function PMDashboard({ user }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [contractFilter, setContractFilter] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const res  = await fetch(`${API}/api/pm/${user.id}/dashboard`)
      const data = await res.json()
      setSummary(data.summary || null)
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) { console.error('load PM dashboard:', e) }
    finally { setLoading(false) }
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // Lưu ghim/nhắc (gửi trạng thái đầy đủ của dòng) rồi cập nhật cục bộ
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

  // Chỉ giữ mốc trong vòng 30 ngày tới (gồm cả mốc đã quá hạn); mốc đã ghim luôn hiện
  const inWindow = useMemo(() => {
    const today = todayISO()
    return items.filter(it => {
      if (it.pinned) return true
      if (!it.due_date) return false
      return daysBetween(it.due_date, today) <= WINDOW_DAYS
    })
  }, [items])

  // Sắp xếp: ghim → tới ngày nhắc → hạn gần nhất
  const sorted = useMemo(() => {
    const today = todayISO()
    const rank = (it) => {
      const remind = effRemind(it)
      const reminding = remind && remind <= today
      return { pin: it.pinned ? 1 : 0, remind: reminding ? 1 : 0 }
    }
    return [...inWindow].sort((a, b) => {
      const ra = rank(a), rb = rank(b)
      if (ra.pin !== rb.pin) return rb.pin - ra.pin
      if (ra.remind !== rb.remind) return rb.remind - ra.remind
      const da = a.due_date || '9999-12-31', db = b.due_date || '9999-12-31'
      return da < db ? -1 : da > db ? 1 : 0
    })
  }, [inWindow])

  // Danh sách số HĐ để lọc
  const contractOptions = useMemo(() => {
    const set = new Set(inWindow.map(it => it.contract_no).filter(Boolean))
    return [...set].sort()
  }, [inWindow])

  // Áp bộ lọc theo số HĐ
  const visible = useMemo(
    () => contractFilter ? sorted.filter(it => it.contract_no === contractFilter) : sorted,
    [sorted, contractFilter]
  )

  if (loading) return <div className="dashboard"><p className="dash-empty">Đang tải bảng theo dõi...</p></div>

  const s = summary || { contractCount: 0, totalVnd: 0, totalUsd: 0, upcomingCount: 0 }
  const today = todayISO()

  return (
    <div className="dashboard pm-dashboard">
      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Bảng theo dõi tiến độ dự án</h1>
          <p className="dash-subtitle">Xin chào PM, <strong>{user?.full_name || user?.email}</strong> — các mốc thời hạn cần theo sát</p>
        </div>
      </div>

      {/* Phần trên: ô tổng quan */}
      <div className="dash-stats pm-stats">
        <StatCard label="Hợp đồng của tôi" value={s.contractCount}        color="#2f6b3a" icon="📋" />
        <StatCard label="Tổng giá trị (VNĐ)" value={`${fmtVnd(s.totalVnd)} đ`} color="#2563eb" icon="💰" />
        <StatCard label="Tổng giá trị (USD)" value={`${fmtUsd(s.totalUsd)} $`} color="#7c3aed" icon="💵" />
        <StatCard label="Mốc sắp đến hạn (≤7 ngày)" value={s.upcomingCount} color="#d97706" icon="⏰" />
      </div>

      {/* Phần dưới: bảng theo dõi & nhắc việc */}
      <div className="dash-section">
        <div className="pm-section-bar">
          <h2 className="dash-section-title">Mốc thời hạn<span className="pm-title-full"> cần theo dõi</span> ({visible.length})</h2>
          {contractOptions.length > 0 && (
            <div className={`pm-filter-wrap ${contractFilter ? 'active' : ''}`} title="Lọc theo số hợp đồng">
              <span className="pm-filter-icon" aria-hidden>⛃</span>
              <select
                className="pm-contract-filter"
                value={contractFilter}
                onChange={e => setContractFilter(e.target.value)}
              >
                <option value="">Tất cả hợp đồng</option>
                {contractOptions.map(no => <option key={no} value={no}>{no}</option>)}
              </select>
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="dash-empty">Chưa có mốc thời hạn nào cần theo dõi.</p>
        ) : visible.length === 0 ? (
          <p className="dash-empty">Không có mốc nào cho hợp đồng đã chọn.</p>
        ) : (
          <div className="pm-track-wrap">
            <table className="pm-track-table">
              <thead>
                <tr>
                  <th className="pm-col-contract">Số HĐ</th>
                  <th>Mốc thời hạn / Công việc</th>
                  <th className="pm-col-actions">Ghim &amp; nhắc</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(it => {
                  const di = dueInfo(it.due_date)
                  const remind = effRemind(it)
                  const reminding = remind && remind <= today
                  return (
                    <tr key={`${it.source_type}:${it.source_id}`} className={it.pinned ? 'pm-row-pinned' : ''}>
                      <td className="pm-col-contract">
                        <button className="pm-contract-link" onClick={() => navigate(targetUrl(it))} title="Mở thẳng tới mục công việc này">
                          {it.contract_no || '—'}
                        </button>
                      </td>
                      <td>
                        <div className="pm-item-head">
                          <span className={`pm-side ${it.side === 'Nhập' ? 'side-in' : 'side-out'}`}>{it.side || 'Bán'}</span>
                          <span className={`pm-kind ${KIND_META[it.kind] || ''}`}>{it.kind}</span>
                          {reminding && <span className="pm-bell" title="Đã tới ngày nhắc">🔔</span>}
                          <span className="pm-item-title">{it.title}</span>
                        </div>
                        <div className="pm-item-meta">
                          <span className={`pm-due ${di.cls}`}>{isoToDisplay(it.due_date) || '—'} · {di.label}</span>
                          {it.sub && <span className="pm-sub">· {it.sub}</span>}
                        </div>
                      </td>
                      <td className="pm-col-actions">
                        <div className="pm-actions">
                          <button
                            className={`pm-pin ${it.pinned ? 'on' : ''}`}
                            title={it.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                            onClick={() => saveTracking(it, { pinned: !it.pinned })}
                          >📌</button>
                          <DateInput
                            className="pm-remind-input"
                            style={{ flex: '1 1 auto', minWidth: 0 }}
                            value={it.remind_at || ''}
                            placeholder={remind ? isoToDisplay(remind) : 'Ngày nhắc'}
                            title="Ngày nhắc (để trống = nhắc khi còn 7 ngày)"
                            onChange={(e) => saveTracking(it, { remind_at: e.target.value || null })}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
