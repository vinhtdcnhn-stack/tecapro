import { pool } from '../db.js'
import { isPmOfContract } from '../middleware/contractAccess.js'
import { notifyAction, notifyInfo, contractLabel, pmUserIds } from '../services/notify.js'
import { contractTaskUnread } from '../services/liveCounts.js'
import { bumpLive } from '../services/eventBus.js'
import { invalidateUserDashboards, invalidateDashboardsForContractTask } from '../services/cacheKeys.js'

// ──────────────────────────────────────────────────────────────────────────────
// Dòng thời gian trao đổi của một CÔNG VIỆC HỢP ĐỒNG (contract_task_entry): Báo cáo /
// Chỉ đạo / Quyết định / Trao đổi theo luồng thời gian — song song dept_work_entry.
//
// Quyền đăng theo vai trò với việc (gác ở controller; route chỉ cần đăng nhập):
//   • directive (chỉ đạo) / decision (quyết định) → PM của HĐ HOẶC admin (quản lý)
//   • report (báo cáo)                            → người được giao việc HOẶC quản lý
//   • discussion (trao đổi)                       → người tạo / người được giao / quản lý
//
// "Người liên quan" = người tạo việc + người được giao + các PM của HĐ.
// Khi có mục mới, người liên quan (trừ tác giả) bị đánh dấu chưa đọc (dòng việc hiện
// chấm) + nhận Telegram. Mở việc (GET entries) tự ghi mốc đã đọc.
// ──────────────────────────────────────────────────────────────────────────────

const ENTRY_TYPES = new Set(['report', 'directive', 'decision', 'discussion'])
const TYPE_LABEL = { report: 'Báo cáo', directive: 'Chỉ đạo', decision: 'Quyết định', discussion: 'Trao đổi' }

// Vai trò của người dùng đối với một việc HĐ — để áp luật đăng + xác định liên quan.
// Trả null nếu không tìm thấy việc. isManager = admin hoặc PM của HĐ.
async function relationOf(taskId, userId, userRole) {
  const { rows } = await pool.query(
    'SELECT contract_out_id, created_by, assigned_to FROM contract_task WHERE id = $1',
    [taskId],
  )
  const t = rows[0]
  if (!t) return null
  const isManager = Number(userRole) === 1 || await isPmOfContract(userId, String(t.contract_out_id))
  return {
    contractId: String(t.contract_out_id),
    createdBy: t.created_by,
    assignedTo: t.assigned_to,
    isCreator: Number(t.created_by) === Number(userId),
    isAssignee: Number(t.assigned_to) === Number(userId),
    isManager,
  }
}

function canPost(type, r) {
  if (!r) return false
  if (type === 'directive' || type === 'decision') return r.isManager
  if (type === 'report') return r.isAssignee || r.isManager
  return r.isManager || r.isCreator || r.isAssignee // discussion
}

// Ghi mốc đã đọc cho viewer ở một việc (để tắt chấm chưa đọc).
async function markRead(taskId, userId) {
  await pool.query(
    `INSERT INTO contract_task_read (task_id, user_id, last_read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (task_id, user_id) DO UPDATE SET last_read_at = now()`,
    [taskId, userId],
  )
}

// GET /tasks/:taskId/entries — danh sách + tự ghi mốc đã đọc.
export async function getEntries(req, res) {
  const taskId = parseInt(req.params.taskId)
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.task_id, e.entry_type, e.content,
              e.author_id, au.full_name AS author_name,
              e.created_at, e.updated_at
         FROM contract_task_entry e
         LEFT JOIN app_user au ON au.id = e.author_id
        WHERE e.task_id = $1
        ORDER BY e.created_at, e.id`,
      [taskId],
    )
    res.json(rows)
    // Đọc xong → tắt chấm chưa đọc + làm mới dashboard người xem để dòng việc hết nền hổ phách.
    markRead(taskId, req.user.id)
      .then(() => { if (rows.length) return invalidateUserDashboards(req.user.id) })
      .catch(e => console.error('contractTask markRead:', e))
  } catch (err) {
    console.error('contractTask getEntries:', err)
    res.status(500).json({ error: 'Không thể tải dòng thời gian.' })
  }
}

// GET /contract-tasks/unread-count — tổng số mục chưa đọc của viewer trên MỌI việc HĐ
// liên quan (người tạo / người được giao / PM của HĐ). Dùng cho cảnh báo nền đỏ toàn trang.
export async function getUnreadCount(req, res) {
  try {
    res.json({ count: await contractTaskUnread(req.user.id) })
  } catch (err) {
    console.error('contractTask getUnreadCount:', err)
    res.status(500).json({ error: 'Không thể lấy số chưa đọc.' })
  }
}

// POST /tasks/:taskId/entries  { entry_type, content }
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
      `INSERT INTO contract_task_entry (task_id, entry_type, content, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id, entry_type, content, author_id, created_at, updated_at`,
      [taskId, type, content, req.user.id],
    )
    const entry = rows[0]
    const me = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [req.user.id])
    const actor = me.rows[0]?.full_name || null
    entry.author_name = actor
    res.status(201).json(entry)

    // Đánh thức các long-poll đang treo: có mục mới → số "chưa đọc" của người liên quan đổi.
    bumpLive('contract-task')
    // Có mục mới → dòng việc chuyển nền hổ phách: làm mới dashboard của người liên quan.
    invalidateDashboardsForContractTask(taskId)

    // Tác giả coi như đã đọc (không tự báo với mình).
    markRead(taskId, req.user.id).catch(e => console.error('contractTask markRead:', e))

    // Báo người liên quan (trừ tác giả): người tạo + người được giao + PM của HĐ.
    const t = await pool.query('SELECT title FROM contract_task WHERE id = $1', [taskId])
    const title = t.rows[0]?.title || 'công việc'
    const related = [...new Set([
      rel.createdBy,
      rel.assignedTo,
      ...await pmUserIds(rel.contractId),
    ])].map(Number).filter(uid => uid && uid !== Number(req.user.id))
    if (related.length) {
      const label = await contractLabel(rel.contractId)
      const msg = `${actor || 'Ai đó'} · ${TYPE_LABEL[type]} ở công việc:\n${title} (HĐ ${label})\n${content}`
      // Báo cáo/chỉ đạo/quyết định cần nắm & xử lý → notifyAction; trao đổi → notifyInfo.
      if (type === 'discussion') notifyInfo(related, msg)
      else notifyAction(related, msg)
    }
  } catch (err) {
    console.error('contractTask addEntry:', err)
    res.status(500).json({ error: 'Không thể gửi nội dung.' })
  }
}

// DELETE /task-entries/:id — tác giả hoặc PM của HĐ / admin.
export async function deleteEntry(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT e.author_id, e.task_id, t.contract_out_id
         FROM contract_task_entry e
         JOIN contract_task t ON t.id = e.task_id
        WHERE e.id = $1`,
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    const isManager = Number(req.user.role) === 1
      || await isPmOfContract(req.user.id, String(rows[0].contract_out_id))
    if (Number(rows[0].author_id) !== Number(req.user.id) && !isManager) {
      return res.status(403).json({ error: 'Bạn chỉ được xóa nội dung của chính mình.' })
    }
    await pool.query('DELETE FROM contract_task_entry WHERE id = $1', [id])
    res.json({ success: true })
    // Xóa mục → số chưa đọc của người liên quan có thể đổi → làm mới dashboard của họ.
    invalidateDashboardsForContractTask(rows[0].task_id)
  } catch (err) {
    console.error('contractTask deleteEntry:', err)
    res.status(500).json({ error: 'Không thể xóa nội dung.' })
  }
}
