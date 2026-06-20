import { useState, useMemo, useRef, useEffect } from 'react'
import './TaskGantt.css'

import { groupByDept, groupByAssignee, fmtDate, initials, buildTaskTree, flattenTree, reorderIds } from './taskUtils'
import { buildGanttModel, LABEL_W, HEAD_H, DAY_W } from './taskGanttUtils'

// ── Gantt công việc triển khai (cây việc con) ───────────────────────────────────
// tasks: TẤT CẢ công việc · visibleIds: tập id qua bộ lọc (null = tất cả) · milestones:
// mốc tiến độ HĐ · onEdit: mở modal sửa · onAdd: mở modal thêm việc (ẩn nút nếu không
// truyền) · onReorder(orderedIds): lưu thứ tự (anh-em) · canReorderRow(task): được phép
// kéo việc đó hay không · children: modal/lớp phủ render BÊN TRONG khung Gantt để khi mở
// toàn màn hình (Fullscreen API) vẫn nằm trên, thao tác được.
export default function TaskGantt({ tasks, visibleIds = null, milestones = [], onEdit, onAdd, onAddSub, canAddSub = () => false, onReorder, canReorderRow = () => false, children }) {
  const [groupBy, setGroupBy] = useState('department')   // 'department' | 'assignee' | 'none'
  const flat = groupBy === 'none'
  const canDrag = flat && typeof onReorder === 'function'   // bật theo từng dòng qua canReorderRow

  // Kéo-thả sắp xếp (chỉ chế độ "Không nhóm").
  const [dragId, setDragId]   = useState(null)
  const [overId, setOverId]   = useState(null)

  // Toàn màn hình: mở khung Gantt phủ kín màn hình, ESC để thoát.
  const [fullscreen, setFullscreen] = useState(false)
  const wrapRef = useRef(null)

  // Dựng cây từ TẤT CẢ việc (giữ quan hệ cha-con); chỉ hiện việc trong visibleIds.
  const { roots, childrenByParent, byId } = useMemo(() => buildTaskTree(tasks), [tasks])
  const visibleTasks = useMemo(() => tasks.filter(t => !visibleIds || visibleIds.has(String(t.id))), [tasks, visibleIds])
  const visibleRoots = useMemo(() => roots.filter(t => !visibleIds || visibleIds.has(String(t.id))), [roots, visibleIds])

  const groups = useMemo(() => {
    const expand = (rootList) => ({ items: flattenTree(rootList, childrenByParent, { visible: visibleIds }) })
    if (flat) return [{ key: '__all__', name: '', ...expand(visibleRoots) }]
    const gs = groupBy === 'assignee' ? groupByAssignee(visibleRoots) : groupByDept(visibleRoots)
    return gs.map(g => ({ key: g.key, name: g.name, ...expand(g.tasks) }))
  }, [visibleRoots, childrenByParent, visibleIds, groupBy, flat])

  const model = useMemo(() => buildGanttModel(visibleTasks, milestones, groups, flat), [visibleTasks, milestones, groups, flat])
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

  // Bật toàn màn hình: yêu cầu Fullscreen API (nếu được) trên khung Gantt; lắng nghe
  // ESC (khung phủ thuần CSS) và fullscreenchange (thoát fullscreen OS) để đóng. Dù
  // trình duyệt chặn Fullscreen API, lớp phủ position:fixed vẫn lấp đầy cửa sổ.
  useEffect(() => {
    if (!fullscreen) return
    wrapRef.current?.requestFullscreen?.().catch(() => {})
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false) }
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFsChange)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [fullscreen])

  function handleDrop(toId) {
    if (!canDrag || dragId == null || dragId === toId) { setDragId(null); setOverId(null); return }
    const dragTask = byId.get(String(dragId))
    if (!dragTask || !canReorderRow(dragTask)) { setDragId(null); setOverId(null); return }
    // Chỉ cho đổi thứ tự TRONG cùng nhóm anh-em (cùng việc cha).
    const dragP = dragTask.parent_task_id ?? null
    const dropP = byId.get(String(toId))?.parent_task_id ?? null
    if (String(dragP) !== String(dropP)) { setDragId(null); setOverId(null); return }
    const sib = model.rows
      .filter(r => r.type === 'task' && (r.task.parent_task_id ?? null) + '' === dragP + '')
      .map(r => r.task.id)
    const next = reorderIds(sib, dragId, toId)
    setDragId(null); setOverId(null)
    if (next.some((id, i) => id !== sib[i])) onReorder(next)
  }

  if (visibleTasks.length === 0) {
    return <div className="task-empty">Không có công việc nào để hiển thị trên Gantt.</div>
  }

  return (
    <div className={`tgantt${fullscreen ? ' tgantt--fullscreen' : ''}`} ref={wrapRef}>
      <div className="tgantt-toolbar">
        <span className="tgantt-toolbar-label">Nhóm theo:</span>
        <div className="tgantt-seg">
          <button className={groupBy === 'department' ? 'active' : ''} onClick={() => setGroupBy('department')}>Phòng ban</button>
          <button className={groupBy === 'assignee' ? 'active' : ''} onClick={() => setGroupBy('assignee')}>Người được giao</button>
          <button className={groupBy === 'none' ? 'active' : ''} onClick={() => setGroupBy('none')}>Không nhóm</button>
        </div>
        {canDrag && <span className="tgantt-drag-hint">Kéo công việc để đổi thứ tự</span>}
        <span className="tgantt-legend">
          <i className="lg lg-wait" /> Chờ
          <i className="lg lg-doing" /> Đang làm
          <i className="lg lg-done" /> Xong
          <i className="lg lg-over" /> Quá hạn
          <i className="lg lg-ms" /> Mốc HĐ
        </span>
        {onAdd && (
          <button
            type="button"
            className="tgantt-add-btn"
            onClick={onAdd}
            title="Thêm công việc"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm công việc
          </button>
        )}
        <button
          type="button"
          className="tgantt-fs-btn"
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'Thu nhỏ (ESC)' : 'Mở toàn màn hình'}
        >
          {fullscreen ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              Thu nhỏ
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              Toàn màn hình
            </>
          )}
        </button>
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
            {rows.map((row, i) => {
              const dragRow = row.type === 'task' && canDrag && canReorderRow(row.task)
              return (
              <div
                key={i}
                className={`tgantt-row tgantt-row--${row.type}`
                  + (dragRow && overId === row.task.id ? ' tgantt-row--dragover' : '')
                  + (dragRow && dragId === row.task.id ? ' tgantt-row--dragging' : '')}
                style={{ height: row.height }}
                onDragOver={dragRow ? (e => { e.preventDefault(); if (overId !== row.task.id) setOverId(row.task.id) }) : undefined}
                onDrop={dragRow ? (e => { e.preventDefault(); handleDrop(row.task.id) }) : undefined}
              >
                <div
                  className={`tgantt-rowlabel${dragRow ? ' tgantt-rowlabel--drag' : ''}`}
                  style={{ width: LABEL_W }}
                  draggable={dragRow || undefined}
                  onDragStart={dragRow ? (() => setDragId(row.task.id)) : undefined}
                  onDragEnd={dragRow ? (() => { setDragId(null); setOverId(null) }) : undefined}
                >
                  {dragRow && <span className="tgantt-drag-grip" aria-hidden>⋮⋮</span>}
                  {row.type === 'group'      && <span className="tgantt-grouplabel">{row.name} <em>· {row.count}</em></span>}
                  {row.type === 'milestones' && <span className="tgantt-mslabel">◆ Mốc tiến độ</span>}
                  {row.type === 'task'       && (
                    <>
                      <span className="tgantt-tasklabel" title={row.task.title} style={{ paddingLeft: (row.depth || 0) * 16 }}>
                        {row.depth > 0 && <span className="tgantt-subdot" aria-hidden>└</span>}
                        <i className="tgantt-ava">{initials(row.task.assigned_to_name)}</i>
                        {row.task.title}
                      </span>
                      {onAddSub && canAddSub(row.task) && (
                        <button
                          type="button"
                          className="tgantt-addsub-btn"
                          onClick={(e) => { e.stopPropagation(); onAddSub(row.task) }}
                          title="Thêm việc con"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        </button>
                      )}
                    </>
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
              )
            })}

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

      {/* Modal/lớp phủ render BÊN TRONG khung Gantt → khi toàn màn hình vẫn thao tác được */}
      {children}
    </div>
  )
}
