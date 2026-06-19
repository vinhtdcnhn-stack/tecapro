// Shared constants & helpers for the task tab and its sub-components.

export const PRIORITIES = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
export const STATUSES   = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

export function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000)
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  return daysUntil(task.due_date) < 0
}

export function isWarning(task) {
  if (!task.due_date || task.status === 'Hoàn thành' || task.status === 'Hủy') return false
  const d = daysUntil(task.due_date)
  return d >= 0 && d <= 3
}

export function priorityClass(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' : p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
export function statusClass(s) {
  return s === 'Chờ xử lý' ? 'status--waiting' : s === 'Đang thực hiện' ? 'status--doing' : s === 'Hoàn thành' ? 'status--done' : 'status--cancel'
}
export function statusModalClass(s) {
  return s === 'Chờ xử lý' ? 'selected-waiting' : s === 'Đang thực hiện' ? 'selected-doing' : s === 'Hoàn thành' ? 'selected-done' : 'selected-cancel'
}

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
}

// ── Nhóm công việc ─────────────────────────────────────────────────────────────
// Dùng chung cho danh sách (ContractTaskTab) và Gantt.

export function groupByDept(tasks) {
  const map = new Map()
  for (const t of tasks) {
    const key  = t.department_id ?? 'none'
    const name = t.department_name ?? 'Chưa phân phòng ban'
    if (!map.has(key)) map.set(key, { key, name, tasks: [] })
    map.get(key).tasks.push(t)
  }
  return [...map.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : 0))
}

export function groupByAssignee(tasks) {
  const map = new Map()
  for (const t of tasks) {
    const key  = t.assigned_to ?? 'none'
    const name = t.assigned_to_name ?? 'Chưa giao'
    if (!map.has(key)) map.set(key, { key, name, tasks: [] })
    map.get(key).tasks.push(t)
  }
  return [...map.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : 0))
}

// ── Lịch / phụ thuộc — tính ngày bắt đầu hiệu lực cho Gantt ─────────────────────

export const dayPart = (v) => (v ? String(v).slice(0, 10) : null)   // 'yyyy-mm-dd[...]' → 'yyyy-mm-dd'

export function addDaysISO(iso, n) {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + (Number(n) || 0))
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

export function maxISO(list) {
  const xs = list.filter(Boolean)
  return xs.length ? xs.reduce((a, b) => (a >= b ? a : b)) : null
}

// Số ngày giữa 2 mốc ISO (b - a), tính theo ngày lịch.
export function diffDays(aISO, bISO) {
  if (!aISO || !bISO) return 0
  const [ay, am, ad] = aISO.slice(0, 10).split('-').map(Number)
  const [by, bm, bd] = bISO.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export const todayISO = () => addDaysISO(new Date().toISOString().slice(0, 10), 0)

// Ngày "hoàn thành" của một bước trước (để bước sau tính ngày bắt đầu):
// việc đã Hoàn thành → completed_at (thực tế); ngược lại → due_date (dự kiến).
function stepFinishDate(task) {
  if (!task) return null
  if (task.status === 'Hoàn thành' && task.completed_at) return dayPart(task.completed_at)
  return dayPart(task.due_date)
}

// Ngày bắt đầu hiệu lực: MAX(ngày hoàn thành từng bước trước + offset); nếu không có
// phụ thuộc resolve được → start_date thủ công; nếu cũng trống → null (caller fallback due_date).
// tasksById / milestonesById: Map khoá theo String(id).
export function resolveTaskStart(task, tasksById, milestonesById) {
  const deps = Array.isArray(task?.dependencies) ? task.dependencies : []
  if (deps.length) {
    const cands = []
    for (const d of deps) {
      let finish = null
      if (d.dep_type === 'task') {
        finish = stepFinishDate(tasksById?.get(String(d.dep_task_id)))
      } else if (d.dep_type === 'milestone') {
        const m = milestonesById?.get(String(d.dep_progress_id))
        finish = m ? (dayPart(m.actual_date) || dayPart(m.planned_date)) : null
      }
      if (finish) cands.push(addDaysISO(finish, d.offset_days))
    }
    const mx = maxISO(cands)
    if (mx) return mx
  }
  return dayPart(task?.start_date)
}
