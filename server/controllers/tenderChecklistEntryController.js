import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { userIsHead, userIsBidMakerOfItem, DEPT_DAU_THAU } from '../middleware/tenderAccess.js'
import { safeUploadFilter, UPLOAD_LIMITS, discardUploadedFile } from '../middleware/uploadFilter.js'
import { notifyAction, notifyInfo } from '../services/notify.js'
import { bumpLive } from '../services/eventBus.js'
import { invalidateUserDashboards, invalidateDashboardsForTenderItem } from '../services/cacheKeys.js'
import { canDeleteEntry, ENTRY_DELETE_DENIED } from '../utils/entryDelete.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

// ──────────────────────────────────────────────────────────────────────────────
// Dòng thời gian trao đổi của một ĐẦU VIỆC đấu thầu (tender_checklist_entry): Báo cáo /
// Chỉ đạo / Quyết định / Trao đổi theo luồng thời gian — song song contract_task_entry.
//
// Quyền đăng theo vai trò với đầu việc (gác ở controller; route chỉ cần là thành viên ban):
//   • directive (chỉ đạo) / decision (quyết định) → Trưởng phòng / người làm thầu (quản lý)
//   • report (báo cáo)                            → người được giao việc HOẶC quản lý
//   • discussion (trao đổi)                       → người tạo / người được giao / quản lý
//
// "Người liên quan" = người tạo đầu việc + người được giao + người làm thầu gói + Trưởng phòng.
// Khi có mục mới, người liên quan (trừ tác giả) nhận Telegram.
// ──────────────────────────────────────────────────────────────────────────────

const ENTRY_TYPES = new Set(['report', 'directive', 'decision', 'discussion'])
const TYPE_LABEL = { report: 'Báo cáo', directive: 'Chỉ đạo', decision: 'Quyết định', discussion: 'Trao đổi' }

// ── Ảnh đính kèm cho mục dòng thời gian (chỉ ảnh) ─────────────────────────────
const imgStorage = multer.diskStorage({
  destination(req, file, cb) {
    const entryId = String(req.params.id)
    if (!/^\d+$/.test(entryId)) { cb(new Error('ID không hợp lệ.')); return }
    const dir = path.join(UPLOADS_ROOT, 'tender-checklist-entries', entryId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${Date.now()}_${safe.replace(/[/\\?%*:|"<>]/g, '_')}`)
  },
})

// Chỉ nhận ảnh: chạy bộ lọc an toàn chung rồi siết thêm mime ảnh.
function imageOnlyFilter(req, file, cb) {
  safeUploadFilter(req, file, (err) => {
    if (err) { cb(err); return }
    if (!String(file.mimetype || '').startsWith('image/')) {
      cb(new Error('Chỉ cho phép đính kèm ảnh.')); return
    }
    cb(null, true)
  })
}

export const uploadEntryImage = multer({ storage: imgStorage, limits: UPLOAD_LIMITS, fileFilter: imageOnlyFilter })

// Gắn mảng ảnh vào từng mục (1 truy vấn cho cả danh sách).
async function attachImages(entries) {
  if (!entries.length) return entries
  const ids = entries.map(e => e.id)
  const { rows } = await pool.query(
    `SELECT id, entry_id, file_name, file_path, mime_type
       FROM tender_checklist_entry_image WHERE entry_id = ANY($1) ORDER BY id`,
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

// Vai trò của người dùng đối với một đầu việc — để áp luật đăng + xác định liên quan.
// Trả null nếu không tìm thấy. isManager = admin / Trưởng phòng / người làm thầu của gói.
async function relationOf(itemId, userId, userRole) {
  const { rows } = await pool.query(
    'SELECT tender_id, created_by, assignee_id FROM tender_checklist_item WHERE id = $1',
    [itemId],
  )
  const it = rows[0]
  if (!it) return null
  const isManager = await userIsHead(userId, userRole) || await userIsBidMakerOfItem(itemId, userId)
  return {
    tenderId: it.tender_id,
    createdBy: it.created_by,
    assigneeId: it.assignee_id,
    isCreator: Number(it.created_by) === Number(userId),
    isAssignee: Number(it.assignee_id) === Number(userId),
    isManager,
  }
}

function canPost(type, r) {
  if (!r) return false
  if (type === 'directive' || type === 'decision') return r.isManager
  if (type === 'report') return r.isAssignee || r.isManager
  return r.isManager || r.isCreator || r.isAssignee // discussion
}

// ID người cần báo tin: người tạo + người được giao + người làm thầu gói + Trưởng phòng ban.
async function relatedUserIds(rel) {
  const [maker, heads] = await Promise.all([
    pool.query('SELECT bid_maker_id FROM tender WHERE id = $1', [rel.tenderId]),
    pool.query(
      `SELECT user_id FROM tender_member
        WHERE department_id = $1 AND is_active AND dept_role = 'HEAD'`,
      [DEPT_DAU_THAU],
    ),
  ])
  return [...new Set([
    rel.createdBy,
    rel.assigneeId,
    maker.rows[0]?.bid_maker_id,
    ...heads.rows.map(r => r.user_id),
  ])].map(Number).filter(Boolean)
}

// Nhãn gói thầu cho thông báo.
async function tenderLabel(tenderId) {
  const { rows } = await pool.query('SELECT package_name FROM tender WHERE id = $1', [tenderId])
  return rows[0]?.package_name || `#${tenderId}`
}

// Ghi mốc đã đọc cho viewer ở một đầu việc (để hết chưa đọc: badge + nền hổ phách).
async function markRead(itemId, userId) {
  await pool.query(
    `INSERT INTO tender_checklist_read (item_id, user_id, last_read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (item_id, user_id) DO UPDATE SET last_read_at = now()`,
    [itemId, userId],
  )
}

// GET /tender/checklist/:itemId/entries — danh sách + tự ghi mốc đã đọc.
export async function getEntries(req, res) {
  const itemId = parseInt(req.params.itemId)
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.item_id, e.entry_type, e.content,
              e.author_id, au.full_name AS author_name,
              e.created_at, e.updated_at
         FROM tender_checklist_entry e
         LEFT JOIN app_user au ON au.id = e.author_id
        WHERE e.item_id = $1
        ORDER BY e.created_at, e.id`,
      [itemId],
    )
    await attachImages(rows)
    // Ghi mốc đã đọc TRƯỚC khi trả về: client làm mới badge ngay sau khi nhận entries, nên
    // trạng thái "đã đọc" phải kịp persist để tenderChecklistUnread tính lại đúng. Lỗi ghi
    // mốc không được chặn việc trả nội dung → nuốt lỗi, chỉ log.
    if (rows.length) {
      try { await markRead(itemId, req.user.id) } catch (e) { console.error('tenderChecklist markRead:', e) }
    }
    res.json(rows)
    // Đọc xong → làm mới dashboard người xem để hết nền hổ phách (không chặn response).
    if (rows.length) invalidateUserDashboards(req.user.id)
  } catch (err) {
    console.error('tenderChecklist getEntries:', err)
    res.status(500).json({ error: 'Không thể tải dòng thời gian.' })
  }
}

// POST /tender/checklist/:itemId/entries  { entry_type, content }
export async function addEntry(req, res) {
  const itemId = parseInt(req.params.itemId)
  const type = ENTRY_TYPES.has(req.body?.entry_type) ? req.body.entry_type : 'discussion'
  const content = req.body?.content?.trim()
  if (!content) return res.status(400).json({ error: 'Nội dung không được để trống.' })
  try {
    const rel = await relationOf(itemId, req.user.id, req.user.role)
    if (!rel) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    if (!canPost(type, rel)) {
      return res.status(403).json({ error: `Bạn không có quyền đăng mục "${TYPE_LABEL[type]}" cho đầu việc này.` })
    }

    const { rows } = await pool.query(
      `INSERT INTO tender_checklist_entry (item_id, entry_type, content, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, item_id, entry_type, content, author_id, created_at, updated_at`,
      [itemId, type, content, req.user.id],
    )
    const entry = rows[0]
    const me = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [req.user.id])
    const actor = me.rows[0]?.full_name || null
    entry.author_name = actor
    entry.images = []
    res.status(201).json(entry)

    // Đánh thức long-poll đang treo: có mục mới → số "chưa đọc" của người liên quan đổi.
    bumpLive('tender')
    // Có mục mới → dòng việc chuyển nền hổ phách: làm mới dashboard người liên quan.
    invalidateDashboardsForTenderItem(itemId)
    // Tác giả coi như đã đọc (không tự chưa-đọc với chính mình).
    markRead(itemId, req.user.id).catch(e => console.error('tenderChecklist markRead:', e))

    // Báo người liên quan (trừ tác giả).
    const it = await pool.query('SELECT title FROM tender_checklist_item WHERE id = $1', [itemId])
    const title = it.rows[0]?.title || 'đầu việc'
    const related = (await relatedUserIds(rel)).filter(uid => uid !== Number(req.user.id))
    if (related.length) {
      const label = await tenderLabel(rel.tenderId)
      const msg = `${actor || 'Ai đó'} · ${TYPE_LABEL[type]} ở đầu việc:\n${title} (Gói thầu ${label})\n${content}`
      // Báo cáo/chỉ đạo/quyết định cần nắm & xử lý → notifyAction; trao đổi → notifyInfo.
      if (type === 'discussion') notifyInfo(related, msg)
      else notifyAction(related, msg)
    }
  } catch (err) {
    console.error('tenderChecklist addEntry:', err)
    res.status(500).json({ error: 'Không thể gửi nội dung.' })
  }
}

// POST /tender/checklist-entries/:id/images  (field 'image') — tác giả mục hoặc quản lý đính ảnh.
export async function addEntryImage(req, res) {
  const id = parseInt(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'Chưa có ảnh.' })
  try {
    const { rows } = await pool.query(
      `SELECT e.author_id, e.item_id
         FROM tender_checklist_entry e WHERE e.id = $1`,
      [id],
    )
    if (!rows.length) {
      discardUploadedFile(req.file) // multer đã ghi file trước khi kiểm tra — dọn lại
      return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    }
    const isManager = await userIsHead(req.user.id, req.user.role)
      || await userIsBidMakerOfItem(rows[0].item_id, req.user.id)
    if (Number(rows[0].author_id) !== Number(req.user.id) && !isManager) {
      discardUploadedFile(req.file)
      return res.status(403).json({ error: 'Không có quyền đính kèm ảnh.' })
    }
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const filePath = `/uploads/tender-checklist-entries/${id}/${req.file.filename}`
    const { rows: img } = await pool.query(
      `INSERT INTO tender_checklist_entry_image (entry_id, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, entry_id, file_name, file_path, mime_type`,
      [id, fileName, filePath, req.file.size, req.file.mimetype],
    )
    res.status(201).json(img[0])
  } catch (err) {
    console.error('tenderChecklist addEntryImage:', err)
    if (!res.headersSent) {
      discardUploadedFile(req.file) // chưa lưu được bản ghi DB → file trên đĩa là mồ côi
      res.status(500).json({ error: 'Không lưu được ảnh.' })
    }
  }
}

// DELETE /tender/checklist-entries/:id — tác giả trong 3 phút đầu, hoặc admin.
export async function deleteEntry(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'SELECT author_id, item_id, created_at FROM tender_checklist_entry WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nội dung.' })
    if (!canDeleteEntry(rows[0], req.user)) {
      return res.status(403).json({ error: ENTRY_DELETE_DENIED })
    }
    const itemId = rows[0].item_id
    await pool.query('DELETE FROM tender_checklist_entry WHERE id = $1', [id])
    // Xóa luôn thư mục ảnh trên đĩa (DB đã CASCADE; defense-in-depth: chỉ trong uploads/tender-checklist-entries).
    const dir = path.resolve(UPLOADS_ROOT, 'tender-checklist-entries', String(id))
    if (dir.startsWith(path.join(UPLOADS_ROOT, 'tender-checklist-entries') + path.sep) && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    res.json({ success: true })
    // Xóa mục → số chưa đọc của người liên quan có thể đổi → đánh thức long-poll + làm mới dashboard.
    bumpLive('tender')
    invalidateDashboardsForTenderItem(itemId)
  } catch (err) {
    console.error('tenderChecklist deleteEntry:', err)
    res.status(500).json({ error: 'Không thể xóa nội dung.' })
  }
}
