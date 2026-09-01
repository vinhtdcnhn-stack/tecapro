import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { isPmOfContract } from '../middleware/contractAccess.js'
import { safeUploadFilter, UPLOAD_LIMITS, discardUploadedFile } from '../middleware/uploadFilter.js'
import { contractTaskUnread } from '../services/liveCounts.js'
import { invalidateUserDashboards, invalidateDashboardsForContractTask } from '../services/cacheKeys.js'
import { canDeleteEntry, ENTRY_DELETE_DENIED } from '../utils/entryDelete.js'
import { insertTaskEntry, announceTaskEntry, markTaskRead as markRead, TYPE_LABEL } from '../services/taskEntryPost.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

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

// ── Tệp đính kèm cho mục dòng thời gian ───────────────────────────────────────
// Nhận MỌI loại tệp an toàn (ảnh, PDF, Word/Excel, nén…) — kỹ thuật phản hồi kết quả
// nhận/kiểm tra hàng bằng file. Ảnh vẫn hiện thu nhỏ trong dòng thời gian, tệp khác
// hiện thành liên kết tải về. Bảng lưu vẫn là contract_task_entry_image (giữ tên cũ).
const imgStorage = multer.diskStorage({
  destination(req, file, cb) {
    const entryId = String(req.params.id)
    if (!/^\d+$/.test(entryId)) { cb(new Error('ID không hợp lệ.')); return }
    const dir = path.join(UPLOADS_ROOT, 'task-entries', entryId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
  },
})

export const uploadEntryImage = multer({ storage: imgStorage, limits: UPLOAD_LIMITS, fileFilter: safeUploadFilter })

// Gắn mảng tệp đính kèm vào từng mục (1 truy vấn cho cả danh sách).
async function attachImages(entries) {
  if (!entries.length) return entries
  const ids = entries.map(e => e.id)
  const { rows } = await pool.query(
    `SELECT id, entry_id, file_name, file_path, file_size, mime_type
       FROM contract_task_entry_image WHERE entry_id = ANY($1) ORDER BY id`,
    [ids],
  )
  const byEntry = new Map()
  for (const r of rows) {
    if (!byEntry.has(String(r.entry_id))) byEntry.set(String(r.entry_id), [])
    byEntry.get(String(r.entry_id)).push(r)
  }
  for (const e of entries) e.images = byEntry.get(String(e.id)) || []
  return entries
}

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
    await attachImages(rows)
    // Ghi mốc đã đọc TRƯỚC khi trả về: client làm mới badge/nền ngay sau khi nhận entries,
    // nên trạng thái "đã đọc" phải kịp persist để contractTaskUnread tính lại đúng (không lệch
    // một nhịp). Lỗi ghi mốc không được chặn việc trả nội dung → nuốt lỗi, chỉ log.
    if (rows.length) {
      try { await markRead(taskId, req.user.id) } catch (e) { console.error('contractTask markRead:', e) }
    }
    res.json(rows)
    // Đọc xong → làm mới dashboard người xem để dòng việc hết nền hổ phách (không chặn response).
    if (rows.length) invalidateUserDashboards(req.user.id).catch(e => console.error('contractTask invalidate:', e))
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

    const entry = await insertTaskEntry({ taskId, type, content, authorId: req.user.id })
    res.status(201).json(entry)

    // Hậu kỳ (không chặn response): đánh thức long-poll, làm mới dashboard người liên quan,
    // ghi mốc đã đọc cho tác giả và báo Telegram cho người liên quan.
    announceTaskEntry({
      taskId, type, content, authorId: req.user.id, authorName: entry.author_name,
      contractId: rel.contractId, createdBy: rel.createdBy, assignedTo: rel.assignedTo,
    })
  } catch (err) {
    console.error('contractTask addEntry:', err)
    res.status(500).json({ error: 'Không thể gửi nội dung.' })
  }
}

// POST /task-entries/:id/attachments (field 'file') — chỉ tác giả mục (hoặc PM/admin) đính tệp.
export async function addEntryImage(req, res) {
  const id = parseInt(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  try {
    const { rows } = await pool.query(
      `SELECT e.author_id, t.contract_out_id
         FROM contract_task_entry e
         JOIN contract_task t ON t.id = e.task_id
        WHERE e.id = $1`,
      [id],
    )
    if (!rows.length) {
      discardUploadedFile(req.file) // multer đã ghi file trước khi kiểm tra — dọn lại
      return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    }
    const isManager = Number(req.user.role) === 1
      || await isPmOfContract(req.user.id, String(rows[0].contract_out_id))
    if (Number(rows[0].author_id) !== Number(req.user.id) && !isManager) {
      discardUploadedFile(req.file)
      return res.status(403).json({ error: 'Không có quyền đính kèm tệp.' })
    }
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const filePath = `/uploads/task-entries/${id}/${req.file.filename}`
    const { rows: img } = await pool.query(
      `INSERT INTO contract_task_entry_image (entry_id, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, entry_id, file_name, file_path, file_size, mime_type`,
      [id, fileName, filePath, req.file.size, req.file.mimetype],
    )
    res.status(201).json(img[0])
  } catch (err) {
    console.error('contractTask addEntryImage:', err)
    if (!res.headersSent) {
      discardUploadedFile(req.file) // chưa lưu được bản ghi DB → file trên đĩa là mồ côi
      res.status(500).json({ error: 'Không lưu được tệp.' })
    }
  }
}

// DELETE /task-entries/:id — tác giả trong 3 phút đầu, hoặc admin.
export async function deleteEntry(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT author_id, task_id, created_at FROM contract_task_entry WHERE id = $1',
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    if (!canDeleteEntry(rows[0], req.user)) {
      return res.status(403).json({ error: ENTRY_DELETE_DENIED })
    }
    await pool.query('DELETE FROM contract_task_entry WHERE id = $1', [id])
    // Xóa luôn thư mục tệp đính kèm trên đĩa (DB đã CASCADE; defense-in-depth: chỉ trong uploads/task-entries).
    const dir = path.resolve(UPLOADS_ROOT, 'task-entries', String(id))
    if (dir.startsWith(path.join(UPLOADS_ROOT, 'task-entries') + path.sep) && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    res.json({ success: true })
    // Xóa mục → số chưa đọc của người liên quan có thể đổi → làm mới dashboard của họ.
    invalidateDashboardsForContractTask(rows[0].task_id)
  } catch (err) {
    console.error('contractTask deleteEntry:', err)
    res.status(500).json({ error: 'Không thể xóa nội dung.' })
  }
}
