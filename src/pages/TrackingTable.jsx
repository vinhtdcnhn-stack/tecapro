import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DateInput, { isoToDisplay } from '../components/contracts/DateInput'
import TaskContextMenu from '../components/contracts/TaskContextMenu'
import { copyToClipboard } from '../components/contracts/taskUtils'
import { absUrl } from '../components/common/deepLink'
import { useRowLongPress } from '../components/contracts/useLongPress'
import {
  WINDOW_DAYS, todayISO, daysBetween, effRemind, KIND_META, targetUrl, dueInfo,
} from './trackingUtils'

// Đoạn text "đường dẫn" để dán vào chat hỏi tình trạng mốc/việc. Kèm dòng 🔗 (nếu mốc gắn
// được vị trí) để người nhận dán vào ô tra cứu trên thanh tiêu đề và nhảy thẳng tới đó.
function buildItemCopyText(it) {
  if (!it) return ''
  const crumbs = []
  if (it.contract_no) crumbs.push(`HĐ ${it.contract_no}`)
  if (it.kind) crumbs.push(it.kind)
  crumbs.push(it.title)
  const di = dueInfo(it.due_date)
  const due = it.due_date ? ` — Hạn: ${isoToDisplay(it.due_date)} (${di.label})` : ''
  const text = `📌 ${crumbs.join(' › ')}${due}`
  const path = targetUrl(it)
  return path ? `${text}\n🔗 ${absUrl(path)}` : text
}

// Bảng theo dõi mốc thời hạn / công việc + ghim/nhắc (chuông). Dùng chung cho
// PMDashboard (mốc của các HĐ user tham gia) và AssigneeDashboard (việc được giao).
//
// Props:
//   items          — mảng item { source_type, source_id, contract_id, contract_no,
//                     contract_in_id?, side, kind, title, sub, due_date, pinned, remind_at }
//   onSaveTracking — (it, patch) => void; lưu ghim/nhắc (parent cập nhật state)
//   title          — tiêu đề mục (ReactNode); số lượng hiển thị được nối tự động
//   emptyMessage   — câu hiển thị khi KHÔNG có item nào
//   windowDays     — chỉ giữ mốc đến hạn trong N ngày tới (mặc định 30); Infinity = mọi mốc
export default function TrackingTable({
  items,
  onSaveTracking,
  title,
  emptyMessage = 'Chưa có mục nào cần theo dõi.',
  windowDays = WINDOW_DAYS,
}) {
  const navigate = useNavigate()
  const [contractFilter, setContractFilter] = useState('')
  const [ctxMenu, setCtxMenu] = useState(null)  // { x, y, task } | null — menu chuột phải/ấn giữ

  function openCtxMenu(it, e) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, task: it }) }
  // Mobile: ấn giữ một hàng → mở menu Sao chép tại điểm chạm.
  const getLongPress = useRowLongPress((it, x, y) => setCtxMenu({ x, y, task: it }))

  // Giữ mốc trong cửa sổ N ngày (gồm cả quá hạn); mốc đã ghim luôn hiện. Item không
  // có hạn chỉ hiện ở chế độ "mọi mốc" (windowDays=Infinity, vd danh sách việc được giao).
  const inWindow = useMemo(() => {
    const today = todayISO()
    return items.filter(it => {
      if (it.pinned) return true
      if (!it.due_date) return windowDays === Infinity
      return daysBetween(it.due_date, today) <= windowDays
    })
  }, [items, windowDays])

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

  const today = todayISO()

  return (
    <div className="dash-section">
      <div className="pm-section-bar">
        <h2 className="dash-section-title">{title} ({visible.length})</h2>
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
        <p className="dash-empty">{emptyMessage}</p>
      ) : visible.length === 0 ? (
        <p className="dash-empty">Không có mục nào cho hợp đồng đã chọn.</p>
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
                const url = targetUrl(it)
                // Màu chữ hạn theo trạng thái: quá hạn → đỏ; còn hạn mà đang nhắc
                // (chuông) → vàng; còn lại → xanh dương nhạt.
                const overdue = di.days != null && di.days <= 0
                const dueCls = overdue ? 'due-overdue' : reminding ? 'due-soon' : 'due-normal'
                return (
                  <tr
                    key={`${it.source_type}:${it.source_id}`}
                    className={it.pinned ? 'pm-row-pinned' : ''}
                    onContextMenu={(e) => openCtxMenu(it, e)}
                    {...getLongPress(it)}
                  >
                    <td className="pm-col-contract">
                      {url ? (
                        <button className="pm-contract-link" onClick={() => navigate(url)} title="Mở thẳng tới mục công việc này">
                          {it.contract_no || '—'}
                        </button>
                      ) : (
                        <span className="pm-contract-plain">{it.contract_no || '—'}</span>
                      )}
                    </td>
                    <td>
                      <div className="pm-item-head">
                        <span className={`pm-side ${it.side === 'Nhập' ? 'side-in' : 'side-out'}`}>{it.side || 'Bán'}</span>
                        <span className={`pm-kind ${KIND_META[it.kind] || ''}`}>{it.kind}</span>
                        {reminding && <span className="pm-bell" title="Đã tới ngày nhắc">🔔</span>}
                        {url ? (
                          <button className="pm-item-title pm-item-title-link" onClick={() => navigate(url)} title="Mở thẳng tới mục công việc này">
                            {it.title}
                          </button>
                        ) : (
                          <span className="pm-item-title">{it.title}</span>
                        )}
                      </div>
                      <div className="pm-item-meta">
                        <span className={`pm-due ${dueCls}`}>{isoToDisplay(it.due_date) || '—'} · {di.label}</span>
                        {it.sub && <span className="pm-sub">· {it.sub}</span>}
                      </div>
                    </td>
                    <td className="pm-col-actions">
                      <div className="pm-actions">
                        <button
                          className={`pm-pin ${it.pinned ? 'on' : ''}`}
                          title={it.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                          onClick={() => onSaveTracking(it, { pinned: !it.pinned })}
                        >📌</button>
                        <DateInput
                          className="pm-remind-input"
                          style={{ flex: '1 1 auto', minWidth: 0 }}
                          value={it.remind_at || ''}
                          placeholder={remind ? isoToDisplay(remind) : 'Ngày nhắc'}
                          title="Ngày nhắc (để trống = nhắc khi còn 7 ngày)"
                          onChange={(e) => onSaveTracking(it, { remind_at: e.target.value || null })}
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

      <TaskContextMenu
        key={ctxMenu ? `${ctxMenu.task.source_type}:${ctxMenu.task.source_id}-${ctxMenu.x}-${ctxMenu.y}` : 'closed'}
        menu={ctxMenu}
        onCopy={(it) => copyToClipboard(buildItemCopyText(it))}
        onClose={() => setCtxMenu(null)}
      />
    </div>
  )
}
