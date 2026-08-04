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

// Chú thích cho dấu ⏳ "chờ xác nhận": ai đã báo hoàn thành, lúc nào, và (nếu từng bị trả
// lại) lý do chưa đạt gần nhất.
export function awaitTitle(task) {
  const who = task.completion_requested_by_name || 'Người thực hiện'
  const when = task.completion_requested_at
    ? new Date(task.completion_requested_at).toLocaleString('vi-VN')
    : ''
  const past = Number(task.completion_reject_count) > 0
    ? `\nĐã bị trả lại ${task.completion_reject_count} lần. Lý do gần nhất: ${task.completion_reject_reason || '—'}`
    : ''
  return `${who} đã báo hoàn thành${when ? ` lúc ${when}` : ''} — chờ người giao việc xác nhận.${past}`
}

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
}

// ── Sao chép thông tin công việc (dán vào chat hỏi tình trạng) ────────────────────
// Tạo đoạn văn bản gọn gồm "đường dẫn" (HĐ → công việc) + nội dung chính của việc.
// contract (tùy chọn) cung cấp số HĐ / tên dự án để người nhận biết việc thuộc đâu.
export function buildTaskCopyText(task, contract = null) {
  if (!task) return ''
  // Đường dẫn: Hợp đồng → (việc cha nếu có) → công việc
  const crumbs = []
  if (contract?.contract_no) crumbs.push(`HĐ ${contract.contract_no}`)
  if (contract?.project_name) crumbs.push(contract.project_name)
  if (task.parent_task_title) crumbs.push(task.parent_task_title)
  crumbs.push(task.title)
  const lines = [`📌 ${crumbs.join(' › ')}`]
  // Đường dẫn điều hướng: dán vào ô tra cứu trên thanh tiêu đề để nhảy đúng việc.
  const cid = contract?.id ?? task.contract_out_id ?? task.contract_id
  if (cid != null) {
    const origin = (typeof window !== 'undefined' && window.location?.origin) || ''
    lines.push(`🔗 ${origin}/qlda/${cid}?tab=contract-tasks&taskId=${task.id}`)
  }
  return lines.join('\n')
}

// Sao chép văn bản vào clipboard (có fallback cho ngữ cảnh không bảo mật/khung fullscreen).
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* rơi xuống fallback */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
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

// ── Cây công việc con (sub-task) ────────────────────────────────────────────────

// Dựng cây từ danh sách phẳng (đã sort theo sort_order). Trả { byId, roots, childrenByParent }.
// roots = việc gốc (parent_task_id null / cha không tồn tại); childrenByParent: Map(parentId→[con]).
export function buildTaskTree(tasks) {
  const byId = new Map(tasks.map(t => [String(t.id), t]))
  const childrenByParent = new Map()
  const roots = []
  for (const t of tasks) {
    const pid = t.parent_task_id != null ? String(t.parent_task_id) : null
    if (pid && byId.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(t)
    } else {
      roots.push(t)
    }
  }
  return { byId, roots, childrenByParent }
}

// Tập id hiển thị theo bộ lọc: node khớp matchFn + TẤT CẢ tổ tiên (giữ cây liền mạch).
export function visibleTaskIds(tasks, matchFn) {
  const byId = new Map(tasks.map(t => [String(t.id), t]))
  const visible = new Set()
  for (const t of tasks) {
    if (!matchFn(t)) continue
    let cur = t
    while (cur) {
      const id = String(cur.id)
      if (visible.has(id)) break
      visible.add(id)
      const pid = cur.parent_task_id != null ? String(cur.parent_task_id) : null
      cur = pid ? byId.get(pid) : null
    }
  }
  return visible
}

// Tạo thứ tự id mới khi kéo `fromId` thả lên `toId` (chèn vào đúng vị trí). Dùng chung
// cho kéo-thả ở Danh sách và Gantt.
export function reorderIds(ids, fromId, toId) {
  if (fromId === toId) return ids
  const from = ids.indexOf(fromId), to = ids.indexOf(toId)
  if (from < 0 || to < 0) return ids
  const a = ids.slice()
  a.splice(from, 1)
  a.splice(to, 0, fromId)
  return a
}

// Tập id việc CHA có ít nhất một việc con TRÙNG TÊN với mình — dấu hiệu việc con sinh
// ra do "Chuyển việc" (handleTransfer tạo việc con giữ nguyên title). Dùng để mặc định
// thu các nhánh này lại ở Danh sách và Gantt (Set chứa id dạng chuỗi).
export function transferredParentIds(tasks) {
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  const byId = new Map(tasks.map(t => [String(t.id), t]))
  const ids = new Set()
  for (const t of tasks) {
    if (t.parent_task_id == null) continue
    const p = byId.get(String(t.parent_task_id))
    if (p && norm(p.title) === norm(t.title)) ids.add(String(p.id))
  }
  return ids
}

// DFS pre-order các việc gốc → [{ task, depth, hasChildren }]. Chỉ đi vào con hiển thị
// (theo `visible`) và node không bị thu (collapsed[id]). visible=null → hiện tất cả.
export function flattenTree(rootTasks, childrenByParent, { collapsed = {}, visible = null } = {}) {
  const out = []
  const vis = (t) => !visible || visible.has(String(t.id))
  const walk = (node, depth) => {
    if (!vis(node)) return
    const kids = (childrenByParent.get(String(node.id)) || []).filter(vis)
    out.push({ task: node, depth, hasChildren: kids.length > 0 })
    if (!collapsed[String(node.id)]) for (const c of kids) walk(c, depth + 1)
  }
  for (const r of rootTasks) walk(r, 0)
  return out
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

// Ngày bắt đầu hiệu lực: MAX(ngày hoàn thành từng bước trước + 1 + offset); nếu không có
// phụ thuộc resolve được → start_date thủ công; nếu cũng trống → null (caller fallback due_date).
// tasksById / milestonesById: Map khoá theo String(id).
export function resolveTaskStart(task, tasksById, milestonesById) {
  // Neo theo việc cha (động): ngày bắt đầu = ngày bắt đầu hiệu lực của việc cha + offset
  // (offset 0 = cùng ngày). Đệ quy lên cha (chuỗi parent_task_id luôn không vòng lặp).
  if (task?.parent_start_offset != null && task?.parent_task_id != null) {
    const parent = tasksById?.get(String(task.parent_task_id))
    const ps = parent ? resolveTaskStart(parent, tasksById, milestonesById) : null
    if (ps) return addDaysISO(ps, Number(task.parent_start_offset) || 0)
  }
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
      // Bắt đầu NGÀY SAU khi bước trước hoàn thành (không chồng lên ngày kết thúc của
      // bước trước); offset_days là số ngày trễ thêm: 0 ngày sau = ngay hôm sau.
      if (finish) cands.push(addDaysISO(finish, (Number(d.offset_days) || 0) + 1))
    }
    const mx = maxISO(cands)
    if (mx) return mx
  }
  return dayPart(task?.start_date)
}
