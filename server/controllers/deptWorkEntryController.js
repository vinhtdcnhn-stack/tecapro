import { pool } from '../db.js'
import { userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'
import { userName, assigneeIds, headIds } from '../services/deptWorkNotify.js'
import { notifyAction, notifyInfo } from '../services/notify.js'
import { deptWorkUnread } from '../services/liveCounts.js'
import { bumpLive } from '../services/eventBus.js'
import { invalidateUserDashboards, invalidateDashboardsForDeptWorkTask } from '../services/cacheKeys.js'

// ──────────────────────────────────────────────────────────────────────────────
// Dòng thời gian trao đổi của một việc phòng (dept_work_entry): Báo cáo / Chỉ đạo /
// Quyết định / Trao đổi theo luồng thời gian. Thay panel "Vấn đề" cũ.
//
// Quyền đăng theo vai trò (gác ở controller; route chỉ chặn người ngoài phòng):
//   • directive (chỉ đạo) / decision (quyết định) → trưởng/phó phòng HOẶC nhóm trưởng việc
//   • report (báo cáo)                            → người đang được giao việc HOẶC trưởng/phó
//   • discussion (trao đổi)                       → mọi người liên quan (người tạo/được giao/trưởng phó)
//
// "Người liên quan" = người tạo việc + người đang được giao (active) + trưởng/phó phòng.
// Khi có mục mới, người liên quan (trừ tác giả) bị đánh dấu chưa đọc (bảng việc nhấp
// nháy) + nhận Telegram. Mở việc (GET entries) tự ghi mốc đã đọc.
// ──────────────────────────────────────────────────────────────────────────────

const ENTRY_TYPES = new Set(['report', 'directive', 'decision', 'discussion'])
const TYPE_LABEL = { report: 'Báo cáo', directive: 'Chỉ đạo', decision: 'Quyết định', discussion: 'Trao đổi' }

// Vai trò của người dùng đối với một việc — để áp luật đăng + xác định liên quan.
async function relationOf(taskId, userId, userRole) {
  const [task, asg, head] = await Promise.all([
    pool.query('SELECT created_by FROM dept_work_task WHERE id = $1', [taskId]),
    pool.query(
      'SELECT is_lead FROM dept_work_assignment WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1',
      [taskId, userId],
    ),
    userIsHeadOrDeputy(userId, userRole),
  ])
  if (!task.rows.length) return null
  return {
    isCreator: task.rows[0].created_by === userId,
    isAssignee: asg.rows.length > 0,
    isLead: !!asg.rows[0]?.is_lead,
    isHead: head,
  }
}

function canPost(type, r) {
  if (!r) return false
  if (type === 'directive' || type === 'decision') return r.isHead || r.isLead
  if (type === 'report') return r.isAssignee || r.isHead
  return r.isHead || r.isCreator || r.isAssignee // discussion
}

// Ghi mốc đã đọc cho viewer ở một việc (để hết nhấp nháy mục chưa đọc).
async function markRead(taskId, userId) {
  await pool.query(
    `INSERT INTO dept_work_task_read (task_id, user_id, last_read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (task_id, user_id) DO UPDATE SET last_read_at = now()`,
    [taskId, userId],
  )
}

// GET /dept-work/tasks/:taskId/entries — danh sách + tự ghi mốc đã đọc.
export async function getEntries(req, res) {
  const taskId = parseInt(req.params.taskId)
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.task_id, e.entry_type, e.content,
              e.author_id, au.full_name AS author_name,
              e.created_at, e.updated_at
         FROM dept_work_entry e
         LEFT JOIN app_user au ON au.id = e.author_id
        WHERE e.task_id = $1
        ORDER BY e.created_at, e.id`,
      [taskId],
    )
    res.json(rows)
    // Đọc xong → hết nhấp nháy chưa đọc + làm mới dashboard người xem để hết nền hổ phách.
    markRead(taskId, req.user.id)
      .then(() => { if (rows.length) return invalidateUserDashboards(req.user.id) })
      .catch(e => console.error('deptWork markRead:', e))
  } catch (err) {
    console.error('deptWork getEntries:', err)
    res.status(500).json({ error: 'Không thể tải dòng thời gian.' })
  }
}

// GET /dept-work/unread-count — tổng số mục chưa đọc của viewer trên MỌI việc liên quan.
// Dùng cho cảnh báo toàn trang (đổi nền đỏ) khi có báo cáo/chỉ đạo mới chưa xem.
export async function getUnreadCount(req, res) {
  try {
    res.json({ count: await deptWorkUnread(req.user.id, req.user.role) })
  } catch (err) {
    console.error('deptWork getUnreadCount:', err)
    res.status(500).json({ error: 'Không thể lấy số chưa đọc.' })
  }
}

// POST /dept-work/tasks/:taskId/entries  { entry_type, content }
export async function addEntry(req, res) {
  const taskId = parseInt(req.params.taskId)
  const type = ENTRY_TYPES.has(req.body?.entry_type) ? req.body.entry_type : 'discussion'
  const content = req.body?.content?.trim()
  if (!content) return res.status(400).json({ error: 'Nội dung không được để trống.' })
  try {
    const rel = await relationOf(taskId, req.user.id, req.user.role)
    if (!rel) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    if (!canPost(type, rel)) {
      return res.status(403).json({ error: `Bạn không có quyền đăng mục "${TYPE_LABEL[type]}" cho việc này.` })
    }

    const { rows } = await pool.query(
      `INSERT INTO dept_work_entry (task_id, entry_type, content, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id, entry_type, content, author_id, created_at, updated_at`,
      [taskId, type, content, req.user.id],
    )
    const entry = rows[0]
    const me = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [req.user.id])
    entry.author_name = me.rows[0]?.full_name || null
    res.status(201).json(entry)

    // Đánh thức các long-poll đang treo: có mục mới → số "chưa đọc" của người liên quan đổi.
    bumpLive('dept-work')
    // Có mục mới → dòng việc chuyển nền hổ phách: làm mới dashboard của người liên quan.
    invalidateDashboardsForDeptWorkTask(taskId)

    // Tác giả coi như đã đọc (không tự nhấp nháy với mình).
    markRead(taskId, req.user.id).catch(e => console.error('deptWork markRead:', e))

    // Báo người liên quan (trừ tác giả): người tạo + người được giao + trưởng/phó phòng.
    const t = await pool.query('SELECT title, created_by FROM dept_work_task WHERE id = $1', [taskId])
    const title = t.rows[0]?.title || 'công việc'
    const related = [...new Set([
      t.rows[0]?.created_by,
      ...await assigneeIds(taskId),
      ...await headIds(),
    ])].filter(uid => uid && uid !== req.user.id)
    if (related.length) {
      const actor = await userName(req.user.id)
      const msg = `${actor} · ${TYPE_LABEL[type]} ở công việc:\n${title}\n${content}`
      // Báo cáo/chỉ đạo/quyết định cần nắm & xử lý → notifyAction; trao đổi → notifyInfo.
      if (type === 'discussion') notifyInfo(related, msg)
      else notifyAction(related, msg)
    }
  } catch (err) {
    console.error('deptWork addEntry:', err)
    res.status(500).json({ error: 'Không thể gửi nội dung.' })
  }
}

// DELETE /dept-work/entries/:id — tác giả hoặc trưởng/phó phòng.
export async function deleteEntry(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query('SELECT author_id, task_id FROM dept_work_entry WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    const isHead = await userIsHeadOrDeputy(req.user.id, req.user.role)
    if (rows[0].author_id !== req.user.id && !isHead) {
      return res.status(403).json({ error: 'Bạn chỉ được xóa nội dung của chính mình.' })
    }
    await pool.query('DELETE FROM dept_work_entry WHERE id = $1', [id])
    res.json({ success: true })
    // Xóa mục → số chưa đọc của người liên quan có thể đổi → làm mới dashboard của họ.
    invalidateDashboardsForDeptWorkTask(rows[0].task_id)
  } catch (err) {
    console.error('deptWork deleteEntry:', err)
    res.status(500).json({ error: 'Không thể xóa nội dung.' })
  }
}
