import { useState, useMemo, useRef, useEffect } from 'react'
import './TaskGantt.css'

import { groupByDept, groupByAssignee, fmtDate, initials } from './taskUtils'
import { buildGanttModel, LABEL_W, HEAD_H, DAY_W } from './taskGanttUtils'

// ── Gantt công việc triển khai ──────────────────────────────────────────────────
// tasks: công việc đã lọc · milestones: mốc tiến độ HĐ · onEdit: mở modal sửa.
export default function TaskGantt({ tasks, milestones = [], onEdit }) {
  const [groupBy, setGroupBy] = useState('department')   // 'department' | 'assignee'

  const groups = useMemo(
    () => (groupBy === 'assignee' ? groupByAssignee(tasks) : groupByDept(tasks)),
    [tasks, groupBy],
  )
  const model = useMemo(() => buildGanttModel(tasks, milestones, groups), [tasks, milestones, groups])
  const { width, monthSegs, days, rows, bodyHeight, arrows, todayX } = model

  // Nền lưới ngày cho mỗi hàng (vạch dọc phân cách từng ngày).
  const gridStyle = {
    width,
    backgroundImage: `repeating-linear-gradient(to right, #eef2f7 0, #eef2f7 1px, transparent 1px, transparent ${DAY_W}px)`,
  }

  // Khi mở Gantt, cuộn ngang để vạch "hôm nay" nằm giữa khung nhìn
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || todayX == null) return
    el.scrollLeft = LABEL_W + todayX - el.clientWidth / 2
  }, [todayX])

  if (tasks.length === 0) {
    return <div className="task-empty">Không có công việc nào để hiển thị trên Gantt.</div>
  }

  return (
    <div className="tgantt">
      <div className="tgantt-toolbar">
        <span className="tgantt-toolbar-label">Nhóm theo:</span>
        <div className="tgantt-seg">
          <button className={groupBy === 'department' ? 'active' : ''} onClick={() => setGroupBy('department')}>Phòng ban</button>
          <button className={groupBy === 'assignee' ? 'active' : ''} onClick={() => setGroupBy('assignee')}>Người được giao</button>
        </div>
        <span className="tgantt-legend">
          <i className="lg lg-wait" /> Chờ
          <i className="lg lg-doing" /> Đang làm
          <i className="lg lg-done" /> Xong
          <i className="lg lg-over" /> Quá hạn
          <i className="lg lg-ms" /> Mốc HĐ
        </span>
      </div>

      <div className="tgantt-scroll" ref={scrollRef}>
        <div className="tgantt-inner" style={{ width: LABEL_W + width }}>
          {/* Header tháng */}
          <div className="tgantt-head" style={{ height: HEAD_H }}>
            <div className="tgantt-head-corner" style={{ width: LABEL_W }}>Công việc / Thời gian</div>
            <div className="tgantt-head-time" style={{ width }}>
              <div className="tgantt-months">
                {monthSegs.map((s, i) => (
                  <div key={i} className="tgantt-month" style={{ left: s.left, width: s.w }}>{s.label}</div>
                ))}
              </div>
              <div className="tgantt-days">
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={`tgantt-day${d.weekend ? ' tgantt-day--wknd' : ''}`}
                    style={{ left: d.left, width: DAY_W }}
                  >
                    {d.dayNum}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="tgantt-body" style={{ height: bodyHeight }}>
            {rows.map((row, i) => (
              <div key={i} className={`tgantt-row tgantt-row--${row.type}`} style={{ height: row.height }}>
                <div className="tgantt-rowlabel" style={{ width: LABEL_W }}>
                  {row.type === 'group'      && <span className="tgantt-grouplabel">{row.name} <em>· {row.count}</em></span>}
                  {row.type === 'milestones' && <span className="tgantt-mslabel">◆ Mốc tiến độ</span>}
                  {row.type === 'task'       && (
                    <span className="tgantt-tasklabel" title={row.task.title}>
                      <i className="tgantt-ava">{initials(row.task.assigned_to_name)}</i>
                      {row.task.title}
                    </span>
                  )}
                </div>
                <div className="tgantt-rowtime" style={gridStyle}>
                  {row.type === 'milestones' && row.markers.map(m => (
                    m.plannedX == null && m.actualX == null ? null : (
                      <span key={m.id}>
                        {m.plannedX != null && (
                          <span className="tgantt-ms tgantt-ms--planned" style={{ left: m.plannedX }}
                            title={`${m.name} · kế hoạch ${fmtDate(m.planned)}`}>◆</span>
                        )}
                        {m.actualX != null && m.actual !== m.planned && (
                          <span className="tgantt-ms tgantt-ms--actual" style={{ left: m.actualX }}
                            title={`${m.name} · thực tế ${fmtDate(m.actual)}`}>◇</span>
                        )}
                      </span>
                    )
                  ))}

                  {row.type === 'task' && (
                    <button
                      className="tgantt-bar"
                      style={{ left: row.left, width: row.width, background: row.color.bg, borderColor: row.color.bd, color: row.color.fg }}
                      onClick={() => onEdit?.(row.task)}
                      title={`${row.task.title}\n${row.startISO ? fmtDate(row.startISO) : '—'} → ${row.endISO ? fmtDate(row.endISO) : '—'}\n${row.task.status}${row.task.assigned_to_name ? ' · ' + row.task.assigned_to_name : ''}`}
                    >
                      <span className="tgantt-bar-text">{row.task.title}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Overlay: vạch mốc + đường hôm nay + mũi tên phụ thuộc */}
            <div className="tgantt-overlay" style={{ left: LABEL_W, width, height: bodyHeight }}>
              {rows[0]?.markers?.filter(m => m.plannedX != null).map(m => (
                <div key={m.id} className="tgantt-vline" style={{ left: m.plannedX }} />
              ))}
              {todayX != null && <div className="tgantt-today" style={{ left: todayX }} title="Hôm nay" />}
              <svg className="tgantt-arrows" width={width} height={bodyHeight}>
                <defs>
                  <marker id="tg-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                  </marker>
                  <marker id="tg-arrow-conflict" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
                  </marker>
                </defs>
                {arrows.map((a, i) => {
                  const midX = Math.max(a.x1 + 10, a.x2 - 10)
                  const d = `M ${a.x1} ${a.y1} H ${midX} V ${a.y2} H ${a.x2}`
                  return (
                    <path key={i} d={d} fill="none"
                      stroke={a.conflict ? '#dc2626' : '#94a3b8'}
                      strokeWidth="1.5"
                      strokeDasharray={a.conflict ? '4 3' : undefined}
                      markerEnd={`url(#${a.conflict ? 'tg-arrow-conflict' : 'tg-arrow'})`} />
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
