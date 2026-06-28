import { pool } from '../db.js'
import { MANAGER_POSITION_IDS } from '../middleware/deptWorkAccess.js'
import { cacheWrap } from '../cache.js'
import { deptDashKey } from '../services/cacheKeys.js'

// Dashboard phòng tổng hợp việc của cả phòng — invalidation chính xác theo head phức tạp;
// dùng TTL ngắn để giới hạn độ trễ khi việc của thành viên đổi (badge real-time vẫn riêng).
const DASH_TTL = 5 * 60 // 5'

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard cho Trưởng/Phó phòng: gom HẾT công việc từ mọi module được phân công
// cho nhân sự thuộc phòng của họ. Việc có nhiều người cùng làm được GỘP về một
// dòng, liệt kê đủ người thực hiện. Trả về cùng định dạng item như pmDashboard để
// tái dùng bảng theo dõi (ghim/nhắc dùng chung pm_dashboard_tracking theo userId
// của trưởng/phó phòng đang xem).
//
// Nguồn việc (assignee là người thuộc phòng):
//   • contract_task.assigned_to            — việc triển khai HĐ bán   (side 'Bán')
//   • dept_work_task ⨝ dept_work_assignment — việc nội bộ phòng        (side 'Phòng')
//   • tender_checklist_item.assignee_id    — đầu việc đấu thầu        (side 'Đấu thầu')
// ──────────────────────────────────────────────────────────────────────────────

const iso = (v) => (v ? String(v).slice(0, 10) : null)
const todayISO = () => new Date(new Date().toDateString()).toISOString().slice(0, 10)

// Gộp danh sách tên (khử trùng, bỏ rỗng) thành chuỗi "A, B, C".
const joinNames = (names) => [...new Set(names.filter(Boolean))].join(', ')

// GET /api/dept/:userId/work-dashboard
export async function getDeptWorkDashboard(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId không hợp lệ' })
  const isAdmin = Number(req.user?.role) === 1
  try {
    // Phòng của người xem + có giữ chức danh Trưởng/Phó ban hay không.
    const { rows: urows } = await pool.query(
      `SELECT u.department_id,
              bool_or(ap.position_id = ANY($2::int[])) AS is_head
         FROM app_user u
         LEFT JOIN app_user_position ap ON ap.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.department_id`,
      [userId, MANAGER_POSITION_IDS],
    )
    const me = urows[0]
    if (!me || !me.department_id) {
      return res.json({ summary: emptySummary(), items: [], department_id: null })
    }
    // Chỉ trưởng/phó phòng (hoặc admin) được xem việc của cả phòng.
    if (!me.is_head && !isAdmin) {
      return res.status(403).json({ error: 'Chỉ trưởng/phó phòng (hoặc admin) mới xem được dashboard này.' })
    }
    const deptId = me.department_id

    const payload = await cacheWrap(deptDashKey(userId), DASH_TTL, async () => {
    // Nhân sự đang hoạt động thuộc phòng → tập user_id để lọc người được giao việc.
    const { rows: members } = await pool.query(
      `SELECT id, full_name FROM app_user
        WHERE department_id = $1 AND is_active IS NOT FALSE`,
      [deptId],
    )
    const memberIds = members.map(m => m.id)
    if (!memberIds.length) return { summary: emptySummary(), items: [], department_id: deptId }

    // Nạp 3 nguồn việc + bản ghi ghim/nhắc của người xem song song.
    const [
      { rows: ctRows },
      { rows: dwRows },
      { rows: tcRows },
      { rows: trk },
    ] = await Promise.all([
      pool.query(
        `SELECT t.id, t.contract_out_id, co.contract_no, t.title, t.due_date,
                t.parent_task_id, u.full_name AS assignee_name
           FROM contract_task t
           JOIN contract_out co ON co.id = t.contract_out_id AND COALESCE(co.is_deleted, false) = false
           JOIN app_user u ON u.id = t.assigned_to
          WHERE t.assigned_to = ANY($1) AND t.due_date IS NOT NULL
            AND t.status NOT IN ('Hoàn thành', 'Completed', 'Đã hủy', 'Cancelled')`,
        [memberIds]),
      pool.query(
        `SELECT t.id, t.title, t.due_date, u.full_name AS assignee_name
           FROM dept_work_task t
           JOIN dept_work_assignment a
             ON a.task_id = t.id AND a.is_active AND a.accept_state <> 'rejected'
            AND a.assignee_id = ANY($1)
           JOIN app_user u ON u.id = a.assignee_id
          WHERE t.status NOT IN ('Hoàn thành', 'Hủy')`,
        [memberIds]),
      pool.query(
        `SELECT i.id, i.title, i.due_date, tn.package_name, u.full_name AS assignee_name
           FROM tender_checklist_item i
           JOIN tender tn ON tn.id = i.tender_id AND COALESCE(tn.is_deleted, false) = false
           JOIN app_user u ON u.id = i.assignee_id
          WHERE i.assignee_id = ANY($1) AND i.status NOT IN ('Hoàn thành', 'Hủy')`,
        [memberIds]),
      pool.query(
        'SELECT source_type, source_id, pinned, remind_at FROM pm_dashboard_tracking WHERE user_id = $1',
        [userId]),
    ])

    const tmap = new Map(trk.map(t => [`${t.source_type}:${t.source_id}`, t]))
    const attach = (it) => {
      const t = tmap.get(`${it.source_type}:${it.source_id}`)
      return { ...it, pinned: t?.pinned || false, remind_at: t?.remind_at ? iso(t.remind_at) : null }
    }

    const items = []

    // ── Việc HĐ bán: gộp các bản sao do chuyển việc (cùng HĐ + tiêu đề + hạn) thành
    //    một dòng, liệt kê đủ người thực hiện. Dùng id nhỏ nhất làm đại diện (ổn định
    //    cho ghim/nhắc + nhảy tới trang).
    const ctGroups = new Map()
    ctRows.forEach(t => {
      const key = `${t.contract_out_id}|${t.title || ''}|${iso(t.due_date)}`
      if (!ctGroups.has(key)) ctGroups.set(key, { rep: t, names: [] })
      const g = ctGroups.get(key)
      g.names.push(t.assignee_name)
      if (Number(t.id) < Number(g.rep.id)) g.rep = t
    })
    for (const { rep, names } of ctGroups.values()) {
      items.push(attach({
        source_type: 'task', source_id: rep.id, side: 'Bán',
        contract_id: rep.contract_out_id, contract_no: rep.contract_no,
        due_date: iso(rep.due_date), title: rep.title || 'Công việc', kind: 'Công việc',
        assignees: joinNames(names), sub: `👤 ${joinNames(names)}`,
      }))
    }

    // ── Việc nội bộ phòng: gộp theo task id (một việc có thể giao nhiều người).
    const dwGroups = new Map()
    dwRows.forEach(t => {
      if (!dwGroups.has(t.id)) dwGroups.set(t.id, { rep: t, names: [] })
      dwGroups.get(t.id).names.push(t.assignee_name)
    })
    for (const { rep, names } of dwGroups.values()) {
      items.push(attach({
        source_type: 'dept_work_task', source_id: rep.id, side: 'Phòng',
        contract_id: null, contract_no: null,
        due_date: iso(rep.due_date), title: rep.title || 'Công việc', kind: 'Công việc',
        assignees: joinNames(names), sub: `👤 ${joinNames(names)}`,
      }))
    }

    // ── Đầu việc đấu thầu: mỗi đầu việc một người được giao.
    tcRows.forEach(t => {
      items.push(attach({
        source_type: 'tender_checklist', source_id: t.id, side: 'Đấu thầu',
        contract_id: null, contract_no: t.package_name,
        due_date: iso(t.due_date), title: t.title || 'Đầu việc', kind: 'Công việc',
        assignees: t.assignee_name || '', sub: `👤 ${t.assignee_name || '—'}`,
      }))
    })

    // ── Summary: tổng số việc + số nhân sự + số việc đến hạn trong 7 ngày ──
    const soon = new Date(todayISO()); soon.setDate(soon.getDate() + 7)
    const soonISO = soon.toISOString().slice(0, 10)
    const upcomingCount = items.filter(i => i.due_date && i.due_date <= soonISO).length

    return {
      department_id: deptId,
      summary: { taskCount: items.length, memberCount: memberIds.length, upcomingCount },
      items,
    }
    })
    res.json(payload)
  } catch (err) {
    console.error('getDeptWorkDashboard:', err)
    res.status(500).json({ error: 'Không thể tải dashboard công việc phòng' })
  }
}

function emptySummary() {
  return { taskCount: 0, memberCount: 0, upcomingCount: 0 }
}
