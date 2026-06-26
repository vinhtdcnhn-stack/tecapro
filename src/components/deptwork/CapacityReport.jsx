import { useState, useEffect, useCallback } from 'react'
import DateInput from '../contracts/DateInput'
import useIsMobile from '../contracts/useIsMobile'
import { useCopyMenu } from '../common/useCopyMenu.jsx'
import { API } from '../../config/api'

const todayIso = () => new Date().toISOString().slice(0, 10)
const firstOfMonthIso = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const utilClass = (u) => u >= 90 ? 'dw-util-high' : u >= 50 ? 'dw-util-mid' : 'dw-util-low'

// Text dán chat: năng lực của một người.
const buildCopyText = (r) =>
  `📌 Năng lực ${r.full_name || ''}${r.team_name ? ` (${r.team_name})` : ''} — Tổng ${Number(r.total_hours || 0).toFixed(1)}h, `
  + `${r.days_logged} ngày ghi, ${r.avg_hours_per_day}h TB/ngày, ${r.tasks_touched} việc chạm, `
  + `${r.completed_tasks} hoàn thành, ${r.utilization}% sử dụng`

// Báo cáo năng lực theo giờ công trong khoảng ngày (head: tất cả; member: chính mình).
export default function CapacityReport({ canManage }) {
  const isMobile = useIsMobile()
  const [from, setFrom] = useState(firstOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [segment, setSegment] = useState('')   // '' | 'PRESALE' | 'POSTSALE' (suy từ vị trí)
  const [data, setData] = useState({ rows: [], working_days: 0 })
  const { getRowProps, copyMenu } = useCopyMenu(buildCopyText, (r) => r.full_name || 'Người')

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to })
      if (segment) qs.set('segment', segment)
      const r = await fetch(`${API}/dept-work/capacity?${qs.toString()}`)
      setData(r.ok ? await r.json() : { rows: [], working_days: 0 })
    } catch (e) { console.error('load capacity:', e) }
  }, [from, to, segment])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  const rows = data.rows || []

  return (
    <div className="dw-cap">
      <div className="dw-log-toolbar">
        <label>Từ <DateInput value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Đến <DateInput value={to} onChange={e => setTo(e.target.value)} /></label>
        {canManage && (
          <label>Nhóm
            <select value={segment} onChange={e => setSegment(e.target.value)}>
              <option value="">— Tất cả —</option>
              <option value="PRESALE">Presale</option>
              <option value="POSTSALE">Postsale</option>
            </select>
          </label>
        )}
        <span className="dw-log-total">Số ngày công: <strong>{data.working_days}</strong></span>
      </div>

      <div className="dw-scroll-area">
      {rows.length === 0 ? (
        <p className="dash-empty">Chưa có dữ liệu năng lực trong khoảng này.</p>
      ) : isMobile ? (
        <div className="dw-cap-cards">
          {rows.map(r => (
            <div key={r.user_id} className="dw-cap-card" {...getRowProps(r)}>
              <div className="dw-cap-card-top">
                <strong>{r.full_name}</strong>
                <span className={`dw-util-badge ${utilClass(r.utilization)}`}>{r.utilization}%</span>
              </div>
              <div className="dw-cap-card-grid">
                <span>Tổng giờ</span><b>{Number(r.total_hours).toFixed(1)}</b>
                <span>Ngày ghi</span><b>{r.days_logged}</b>
                <span>Giờ TB/ngày</span><b>{r.avg_hours_per_day}</b>
                <span>Việc chạm</span><b>{r.tasks_touched}</b>
                <span>Hoàn thành</span><b>{r.completed_tasks}</b>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="tracking-table dw-cap-table">
          <thead>
            <tr>
              <th>Người</th><th>Nhóm</th>
              <th className="num">Tổng giờ</th><th className="num">Ngày ghi</th>
              <th className="num">Giờ TB/ngày</th><th className="num">Việc chạm</th>
              <th className="num">Hoàn thành</th><th className="num">% sử dụng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.user_id} {...getRowProps(r)}>
                <td>{r.full_name}</td>
                <td>{r.team_name || '—'}</td>
                <td className="num">{Number(r.total_hours).toFixed(1)}</td>
                <td className="num">{r.days_logged}</td>
                <td className="num">{r.avg_hours_per_day}</td>
                <td className="num">{r.tasks_touched}</td>
                <td className="num">{r.completed_tasks}</td>
                <td className="num"><span className={`dw-util-badge ${utilClass(r.utilization)}`}>{r.utilization}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
      {copyMenu}
    </div>
  )
}
