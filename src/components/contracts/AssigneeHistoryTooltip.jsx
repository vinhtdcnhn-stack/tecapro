import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API } from '../../config/api'
import { fmtDate } from './taskUtils'
import './AssigneeHistoryTooltip.css'

// ── Hint khi di chuột vào tên người thực hiện ───────────────────────────────────
// Bao quanh tên người thực hiện; khi rê chuột vào sẽ tải & hiển thị NHẬT KÝ giao/chuyển
// việc của công việc (lần đầu giao + mỗi lần chuyển). Tải lười (chỉ khi hover lần đầu)
// và nhớ kết quả theo taskId để không gọi lại. children = phần tử tên hiển thị.
// Popover render qua portal + position:fixed để KHÔNG bị bảng (overflow:hidden) cắt mất.
const cache = new Map()  // taskId → log[] (dùng chung trong phiên, tránh fetch lặp)

export default function AssigneeHistoryTooltip({ taskId, children }) {
  const [open, setOpen]    = useState(false)
  const [pos, setPos]      = useState({ left: 0, top: 0 })
  const [log, setLog]      = useState(() => cache.get(String(taskId)) || null)
  const [loading, setLoad] = useState(false)
  const anchorRef = useRef(null)
  const timer = useRef(null)

  async function load() {
    if (log || loading) return
    setLoad(true)
    try {
      const res = await fetch(`${API}/tasks/${taskId}/assignment-log`)
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      cache.set(String(taskId), arr)
      setLog(arr)
    } catch { setLog([]) }
    finally { setLoad(false) }
  }

  function onEnter() {
    clearTimeout(timer.current)
    const r = anchorRef.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 6 })
    setOpen(true)
    load()
  }
  function onLeave() {
    timer.current = setTimeout(() => setOpen(false), 120)
  }

  // Một dòng mô tả sự kiện giao/chuyển.
  function lineOf(e) {
    if (e.action === 'transfer' && e.from_name) {
      return <>Chuyển từ <strong>{e.from_name}</strong> → <strong>{e.to_name}</strong></>
    }
    return <>Giao cho <strong>{e.to_name}</strong></>
  }

  return (
    <span ref={anchorRef} className="assignee-hist" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {open && createPortal(
        <div
          className="assignee-hist-pop"
          style={{ left: pos.left, top: pos.top }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <div className="assignee-hist-title">Lịch sử giao việc</div>
          {loading && !log && <div className="assignee-hist-empty">Đang tải…</div>}
          {log && log.length === 0 && <div className="assignee-hist-empty">Chưa có lịch sử.</div>}
          {log && log.length > 0 && (
            <ul className="assignee-hist-list">
              {log.map(e => (
                <li key={e.id} className={e.action === 'transfer' ? 'is-transfer' : 'is-assign'}>
                  <div className="assignee-hist-line">{lineOf(e)}</div>
                  <div className="assignee-hist-meta">
                    {fmtDate(e.created_at)}
                    {e.actor_name ? ` · bởi ${e.actor_name}` : ''}
                  </div>
                  {e.note && <div className="assignee-hist-note">“{e.note}”</div>}
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
