// Tính toán bố cục cho Gantt công việc triển khai (thuần hàm, không React).
import { resolveTaskStart, dayPart, diffDays, addDaysISO, todayISO, isOverdue } from './taskUtils'

export const DAY_W   = 26    // px mỗi ngày
export const ROW_H   = 34    // chiều cao 1 hàng công việc / hàng mốc
export const GROUP_H = 30    // chiều cao hàng tiêu đề nhóm
export const LABEL_W = 230   // bề rộng cột nhãn trái
export const HEAD_H  = 48    // chiều cao header (dải tháng + dải ngày)

// Màu thanh theo trạng thái (đỏ khi quá hạn).
function barColor(task, overdue) {
  if (task.status === 'Hoàn thành')     return { bg:'#bbf7d0', bd:'#16a34a', fg:'#14532d' }
  if (overdue)                          return { bg:'#fecaca', bd:'#dc2626', fg:'#7f1d1d' }
  if (task.status === 'Đang thực hiện') return { bg:'#bfdbfe', bd:'#2563eb', fg:'#1e3a8a' }
  if (task.status === 'Hủy')            return { bg:'#e5e7eb', bd:'#9ca3af', fg:'#6b7280' }
  return { bg:'#e5e7eb', bd:'#9ca3af', fg:'#374151' }   // Chờ xử lý
}

// tasks: công việc đã lọc; milestones: mốc tiến độ HĐ; groups: [{key,name,tasks}] đã nhóm.
export function buildGanttModel(tasks, milestones, groups) {
  const tasksById = new Map(tasks.map(t => [String(t.id), t]))
  const msById    = new Map(milestones.map(m => [String(m.id), m]))

  // Ngày bắt đầu/kết thúc hiệu lực từng việc.
  const startOf = new Map(), endOf = new Map()
  for (const t of tasks) {
    const s = resolveTaskStart(t, tasksById, msById) || dayPart(t.due_date)
    // duration_days != null → làm trong N ngày: hạn = ngày bắt đầu hiệu lực + (N-1)
    // (đi theo start nếu start dời).
    let e = (t.duration_days != null && s)
      ? addDaysISO(s, Math.max(1, t.duration_days) - 1)
      : (dayPart(t.due_date) || s)
    if (s && e && e < s) e = s
    startOf.set(String(t.id), s); endOf.set(String(t.id), e)
  }

  // Khung thời gian: min/max mọi mốc + hôm nay, đệm ±7 ngày.
  const dates = []
  for (const t of tasks) { const s = startOf.get(String(t.id)), e = endOf.get(String(t.id)); if (s) dates.push(s); if (e) dates.push(e) }
  for (const m of milestones) { const p = dayPart(m.planned_date), a = dayPart(m.actual_date); if (p) dates.push(p); if (a) dates.push(a) }
  dates.push(todayISO())
  const valid = dates.filter(Boolean).sort()
  const originISO = addDaysISO(valid[0] || todayISO(), -7)
  const lastISO   = addDaysISO(valid[valid.length - 1] || todayISO(), 7)
  const totalDays = Math.max(1, diffDays(originISO, lastISO) + 1)
  const width = totalDays * DAY_W
  const xFor = (iso) => (iso ? diffDays(originISO, iso) * DAY_W : 0)

  // Dải tháng cho header.
  const monthSegs = []
  for (let i = 0; i < totalDays; i++) {
    const iso = addDaysISO(originISO, i)
    const ym = iso.slice(0, 7)
    const last = monthSegs[monthSegs.length - 1]
    if (last && last.ym === ym) last.days++
    else monthSegs.push({ ym, label: `Th${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`, start: i, days: 1 })
  }
  for (const s of monthSegs) { s.left = s.start * DAY_W; s.w = s.days * DAY_W }

  // Dải ngày cho header + đánh dấu cuối tuần.
  const days = []
  for (let i = 0; i < totalDays; i++) {
    const iso = addDaysISO(originISO, i)
    const dow = new Date(iso + 'T00:00:00').getDay()   // 0 = CN, 6 = T7
    days.push({ iso, left: i * DAY_W, dayNum: Number(iso.slice(8, 10)), weekend: dow === 0 || dow === 6 })
  }

  // Hàng: 1 hàng mốc trên cùng + theo nhóm.
  const rows = []
  let top = 0
  const markers = milestones.map(m => {
    const p = dayPart(m.planned_date), a = dayPart(m.actual_date)
    return {
      id: m.id, name: m.bb_name || m.bb_code || `Mốc #${m.id}`,
      planned: p, actual: a, plannedX: p ? xFor(p) : null, actualX: a ? xFor(a) : null,
    }
  })
  rows.push({ type: 'milestones', top, height: ROW_H, markers })
  const msRowTop = top
  top += ROW_H

  const taskTop = new Map()
  for (const g of groups) {
    rows.push({ type: 'group', key: g.key, name: g.name, count: g.tasks.length, top, height: GROUP_H })
    top += GROUP_H
    const sorted = [...g.tasks].sort((a, b) => {
      const sa = startOf.get(String(a.id)) || '', sb = startOf.get(String(b.id)) || ''
      return sa < sb ? -1 : sa > sb ? 1 : 0
    })
    for (const t of sorted) {
      const s = startOf.get(String(t.id)), e = endOf.get(String(t.id))
      const overdue = isOverdue(t)
      const wdays = s && e ? diffDays(s, e) + 1 : 1
      rows.push({
        type: 'task', task: t, top, height: ROW_H,
        startISO: s, endISO: e, left: xFor(s), width: Math.max(DAY_W, wdays * DAY_W),
        color: barColor(t, overdue), overdue,
      })
      taskTop.set(String(t.id), top)
      top += ROW_H
    }
  }
  const bodyHeight = top

  // Mũi tên phụ thuộc: từ điểm kết thúc bước trước → điểm bắt đầu việc phụ thuộc.
  const arrows = []
  for (const t of tasks) {
    const depTop = taskTop.get(String(t.id))
    if (depTop == null) continue
    const sIso = startOf.get(String(t.id))
    const x2 = xFor(sIso), y2 = depTop + ROW_H / 2
    for (const d of (t.dependencies || [])) {
      let x1 = null, y1 = null, finIso = null
      if (d.dep_type === 'task') {
        const pTop = taskTop.get(String(d.dep_task_id))
        if (pTop == null) continue
        finIso = endOf.get(String(d.dep_task_id))
        x1 = xFor(finIso) + DAY_W; y1 = pTop + ROW_H / 2
      } else if (d.dep_type === 'milestone') {
        const m = msById.get(String(d.dep_progress_id))
        if (!m) continue
        finIso = dayPart(m.actual_date) || dayPart(m.planned_date)
        if (!finIso) continue
        x1 = xFor(finIso); y1 = msRowTop + ROW_H / 2
      }
      if (x1 == null) continue
      arrows.push({ x1, y1, x2, y2, conflict: !!(sIso && finIso && sIso < finIso) })
    }
  }

  return { width, originISO, xFor, monthSegs, days, rows, bodyHeight, arrows, todayX: xFor(todayISO()) }
}
