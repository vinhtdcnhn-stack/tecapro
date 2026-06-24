import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { notifyAction, notifyInfo } from '../services/notify.js'
import { logActivity } from './tenderController.js'

// ──────────────────────────────────────────────────────────────────────────────
// Review theo TỪNG ĐẦU VIỆC (GĐ "curate + duyệt", thay review cả gói theo phiên bản).
//
// Người phụ trách gói (bid_maker) rà soát tệp sản phẩm do người thực hiện nộp:
//   • Đánh dấu LOẠI file/thư mục (review_excluded) — KHÔNG xoá, chỉ bỏ khỏi tập review.
//   • Tải file THAY THẾ (replaces_file_id) — file mới thế chỗ bản gốc TRONG tập review,
//     bản gốc vẫn giữ để đối chiếu.
//   • Gửi đầu việc sang Trưởng ban duyệt (review_status: draft/returned → pending).
// Trưởng ban kết luận Đạt (approved) / Trả lại (returned → về lại người phụ trách gói).
// ──────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads')

async function tenderLabel(tenderId) {
  const { rows } = await pool.query('SELECT package_name FROM tender WHERE id = $1', [tenderId])
  return rows[0]?.package_name || `#${tenderId}`
}

// Tập hợp id thư mục bị loại (gồm cả con cháu của thư mục bị loại). Chuẩn hoá khoá bằng
// String() vì document_folder.id là integer (number) còn parent_id/folder_id là bigint (string).
function excludedFolderIds(folders) {
  const childrenOf = new Map()
  for (const f of folders) {
    const k = f.parent_id == null ? 'root' : String(f.parent_id)
    if (!childrenOf.has(k)) childrenOf.set(k, [])
    childrenOf.get(k).push(f)
  }
  const excluded = new Set()
  const walk = (folder, inheritedExcluded) => {
    const isExcluded = inheritedExcluded || folder.review_excluded
    if (isExcluded) excluded.add(String(folder.id))
    for (const c of childrenOf.get(String(folder.id)) || []) walk(c, isExcluded)
  }
  for (const f of folders.filter(f => f.parent_id == null)) walk(f, false)
  return excluded
}

// Tập tệp gửi review của 1 đầu việc: bỏ tệp bị loại / nằm trong thư mục bị loại / bị
// thay thế bởi 1 file thay thế còn hiệu lực. File thay thế hiển thị thay cho bản gốc.
async function reviewSetFiles(itemId) {
  const { rows: files } = await pool.query(
    `SELECT df.id, df.folder_id, df.file_name, df.file_size, df.mime_type,
            df.uploaded_by, df.uploaded_at, df.review_excluded, df.replaces_file_id,
            u.full_name AS uploaded_by_name, f.folder_name
       FROM document_file df
       LEFT JOIN app_user u ON u.id = df.uploaded_by
       LEFT JOIN document_folder f ON f.id = df.folder_id
      WHERE df.item_id = $1
      ORDER BY df.uploaded_at`,
    [itemId],
  )
  const { rows: folders } = await pool.query(
    'SELECT id, parent_id, review_excluded FROM document_folder WHERE item_id = $1', [itemId])
  const badFolders = excludedFolderIds(folders)

  // File "còn hiệu lực" = không bị loại và không nằm trong thư mục bị loại.
  const active = (f) => !f.review_excluded && !(f.folder_id && badFolders.has(String(f.folder_id)))
  // File gốc bị thay thế bởi 1 replacement còn hiệu lực thì ẩn khỏi tập review.
  const supersededIds = new Set(
    files.filter(f => f.replaces_file_id && active(f)).map(f => String(f.replaces_file_id)))

  return files
    .filter(f => active(f) && !supersededIds.has(String(f.id)))
    .map(f => ({ ...f, is_replacement: f.replaces_file_id != null }))
}

// GET /tender/:id/review — các đầu việc ĐÃ gửi review (pending/approved/returned) kèm
// tập tệp gửi review + lịch sử duyệt. Dùng cho tab Review & Comment (theo đầu việc).
export async function getItemsForReview(req, res) {
  const tenderId = parseInt(req.params.id)
  try {
    const { rows: items } = await pool.query(
      `SELECT i.id, i.title, i.status, i.review_status, i.review_comment,
              i.review_submitted_at, i.review_decided_at,
              d.name AS department_name, sub.full_name AS submitted_by_name,
              i.assignee_id, asg.full_name AS assignee_name
         FROM tender_checklist_item i
         LEFT JOIN department d ON d.id = i.department_id
         LEFT JOIN app_user sub ON sub.id = i.review_submitted_by
         LEFT JOIN app_user asg ON asg.id = i.assignee_id
        WHERE i.tender_id = $1 AND i.review_status IN ('pending','approved','returned')
        ORDER BY CASE i.review_status WHEN 'pending' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END,
                 i.review_submitted_at DESC NULLS LAST, i.id`,
      [tenderId],
    )
    if (!items.length) return res.json([])

    const { rows: reviews } = await pool.query(
      `SELECT r.id, r.item_id, r.conclusion, r.comment, r.created_at,
              r.reviewer_id, u.full_name AS reviewer_name
         FROM tender_item_review r
         LEFT JOIN app_user u ON u.id = r.reviewer_id
        WHERE r.item_id = ANY($1::bigint[])
        ORDER BY r.created_at DESC`,
      [items.map(i => i.id)],
    )
    const reviewsByItem = new Map()
    for (const rv of reviews) {
      const k = String(rv.item_id)
      if (!reviewsByItem.has(k)) reviewsByItem.set(k, [])
      reviewsByItem.get(k).push(rv)
    }

    const out = []
    for (const it of items) {
      out.push({
        ...it,
        files: await reviewSetFiles(it.id),
        reviews: reviewsByItem.get(String(it.id)) || [],
      })
    }
    res.json(out)
  } catch (err) {
    console.error('getItemsForReview:', err)
    res.status(500).json({ error: 'Không thể tải dữ liệu review.' })
  }
}

// POST /tender/checklist/:itemId/review/submit — người phụ trách gói gửi đầu việc duyệt.
export async function submitItemReview(req, res) {
  const itemId = parseInt(req.params.itemId)
  try {
    const { rows } = await pool.query(
      'SELECT tender_id, title, status, review_status FROM tender_checklist_item WHERE id = $1', [itemId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    const it = rows[0]
    if (it.status !== 'Hoàn thành') {
      return res.status(400).json({ error: 'Chỉ gửi review khi đầu việc đã Hoàn thành.' })
    }
    if (!['draft', 'returned'].includes(it.review_status)) {
      return res.status(400).json({ error: 'Đầu việc không ở trạng thái có thể gửi review.' })
    }
    await pool.query(
      `UPDATE tender_checklist_item
          SET review_status='pending', review_submitted_by=$1, review_submitted_at=now(), updated_at=now()
        WHERE id=$2`,
      [req.user.id, itemId],
    )
    logActivity(it.tender_id, req.user.id, 'review', `Gửi review đầu việc "${it.title}"`)
    // Báo các Trưởng phòng (HEAD) — cần xử lý → notifyAction.
    const { rows: heads } = await pool.query(
      "SELECT user_id FROM tender_member WHERE department_id = 9 AND is_active AND dept_role = 'HEAD'")
    const headIds = heads.map(h => Number(h.user_id)).filter(id => id !== req.user.id)
    if (headIds.length) {
      const label = await tenderLabel(it.tender_id)
      notifyAction(headIds, `Đầu việc "${it.title}" — Gói thầu ${label} chờ bạn review`)
    }
    res.json({ success: true })
  } catch (err) {
    console.error('submitItemReview:', err)
    res.status(500).json({ error: 'Không thể gửi review.' })
  }
}

// POST /tender/checklist/:itemId/review/decide — Trưởng ban kết luận Đạt/Trả lại.
export async function decideItemReview(req, res) {
  const itemId = parseInt(req.params.itemId)
  const conclusion = String(req.body?.conclusion ?? '').trim()
  const comment = String(req.body?.comment ?? '').trim() || null
  if (!['pass', 'fail'].includes(conclusion)) {
    return res.status(400).json({ error: 'Kết luận không hợp lệ.' })
  }
  if (conclusion === 'fail' && !comment) {
    return res.status(400).json({ error: 'Cần ghi lý do khi trả lại.' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT i.tender_id, i.title, i.review_status, i.review_submitted_by, t.bid_maker_id
         FROM tender_checklist_item i JOIN tender t ON t.id = i.tender_id
        WHERE i.id = $1`, [itemId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    const it = rows[0]
    if (it.review_status !== 'pending') {
      return res.status(400).json({ error: 'Đầu việc không ở trạng thái chờ duyệt.' })
    }
    const newStatus = conclusion === 'pass' ? 'approved' : 'returned'
    await pool.query(
      'INSERT INTO tender_item_review (item_id, reviewer_id, conclusion, comment) VALUES ($1,$2,$3,$4)',
      [itemId, req.user.id, conclusion, comment])
    await pool.query(
      `UPDATE tender_checklist_item
          SET review_status=$1, review_decided_by=$2, review_decided_at=now(),
              review_comment=$3, updated_at=now()
        WHERE id=$4`,
      [newStatus, req.user.id, comment, itemId])
    logActivity(it.tender_id, req.user.id, 'review',
      `Review đầu việc "${it.title}": ${conclusion === 'pass' ? 'ĐẠT' : 'TRẢ LẠI'}${comment ? ` — ${comment}` : ''}`)
    // Báo người phụ trách gói + người đã gửi review.
    const targets = [...new Set([it.bid_maker_id, it.review_submitted_by]
      .map(Number).filter(id => id && id !== req.user.id))]
    if (targets.length) {
      if (conclusion === 'pass') {
        notifyInfo(targets, `Đầu việc "${it.title}" đã được duyệt ĐẠT.`)
      } else {
        notifyAction(targets, `🔁 Đầu việc "${it.title}" bị TRẢ LẠI: ${comment}`)
      }
    }
    res.json({ success: true })
  } catch (err) {
    console.error('decideItemReview:', err)
    res.status(500).json({ error: 'Không thể lưu kết luận review.' })
  }
}

// POST /tender/checklist/:itemId/review/reopen — Trưởng ban THU HỒI kết luận đã duyệt để
// xem xét lại. 'approved' → 'pending' (mở lại form kết luận), ghi lịch sử + thông báo.
export async function reopenItemReview(req, res) {
  const itemId = parseInt(req.params.itemId)
  const comment = String(req.body?.comment ?? '').trim() || null
  try {
    const { rows } = await pool.query(
      `SELECT i.tender_id, i.title, i.review_status, i.review_submitted_by, t.bid_maker_id
         FROM tender_checklist_item i JOIN tender t ON t.id = i.tender_id
        WHERE i.id = $1`, [itemId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    const it = rows[0]
    if (it.review_status !== 'approved') {
      return res.status(400).json({ error: 'Chỉ thu hồi được kết luận của đầu việc đã duyệt Đạt.' })
    }
    // Ghi lịch sử thu hồi (conclusion 'reopen') để giữ vết quyết định.
    await pool.query(
      'INSERT INTO tender_item_review (item_id, reviewer_id, conclusion, comment) VALUES ($1,$2,$3,$4)',
      [itemId, req.user.id, 'reopen', comment])
    await pool.query(
      `UPDATE tender_checklist_item
          SET review_status='pending', review_decided_by=NULL, review_decided_at=NULL,
              review_comment=$1, updated_at=now()
        WHERE id=$2`,
      [comment, itemId])
    logActivity(it.tender_id, req.user.id, 'review',
      `Thu hồi kết luận duyệt đầu việc "${it.title}"${comment ? ` — ${comment}` : ''}`)
    const targets = [...new Set([it.bid_maker_id, it.review_submitted_by]
      .map(Number).filter(id => id && id !== req.user.id))]
    if (targets.length) {
      notifyAction(targets, `↩ Trưởng ban THU HỒI kết luận duyệt đầu việc "${it.title}" để xem xét lại${comment ? `: ${comment}` : ''}`)
    }
    res.json({ success: true })
  } catch (err) {
    console.error('reopenItemReview:', err)
    res.status(500).json({ error: 'Không thể thu hồi kết luận.' })
  }
}

// PUT /tender/checklist/file/:fileId/review-exclude  { excluded }
export async function toggleFileExcluded(req, res) {
  const fileId = parseInt(req.params.fileId)
  const excluded = req.body?.excluded === true || req.body?.excluded === 'true'
  try {
    const { rows } = await pool.query(
      'UPDATE document_file SET review_excluded=$1 WHERE id=$2 RETURNING id', [excluded, fileId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tệp.' })
    res.json({ success: true, review_excluded: excluded })
  } catch (err) {
    console.error('toggleFileExcluded:', err)
    res.status(500).json({ error: 'Không thể cập nhật đánh dấu.' })
  }
}

// PUT /tender/checklist/folder/:folderId/review-exclude  { excluded }
export async function toggleFolderExcluded(req, res) {
  const folderId = parseInt(req.params.folderId)
  const excluded = req.body?.excluded === true || req.body?.excluded === 'true'
  try {
    const { rows } = await pool.query(
      'UPDATE document_folder SET review_excluded=$1 WHERE id=$2 RETURNING id', [excluded, folderId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy thư mục.' })
    res.json({ success: true, review_excluded: excluded })
  } catch (err) {
    console.error('toggleFolderExcluded:', err)
    res.status(500).json({ error: 'Không thể cập nhật đánh dấu.' })
  }
}

// POST /tender/checklist/:itemId/review/replacement (multipart) { folderId, replacesFileId }
// Tải file THAY THẾ — bỏ qua khoá "Hoàn thành" vì đây là thao tác curate của người phụ
// trách gói (guard isItemReviewCurator). Bản gốc được giữ nguyên (chỉ ẩn khỏi tập review).
export async function uploadReplacement(req, res) {
  const itemId = parseInt(req.params.itemId)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp.' })
  const folderId = req.body?.folderId && req.body.folderId !== 'root' ? parseInt(req.body.folderId) : null
  const replacesFileId = req.body?.replacesFileId ? parseInt(req.body.replacesFileId) : null
  try {
    // Bản gốc bị thay thế (nếu có) phải thuộc đúng đầu việc này.
    if (replacesFileId) {
      const { rows: orig } = await pool.query(
        'SELECT folder_id FROM document_file WHERE id = $1 AND item_id = $2', [replacesFileId, itemId])
      if (!orig.length) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Không tìm thấy tệp gốc cần thay thế.' }) }
    }
    const filePath = `/uploads/tender/items/${itemId}/${req.file.filename}`
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const { rows } = await pool.query(
      `INSERT INTO document_file (item_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by, replaces_file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [itemId, folderId, fileName, filePath, req.file.size, req.file.mimetype, req.user?.id || null, replacesFileId])
    res.status(201).json(rows[0])
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* noop */ } }
    console.error('uploadReplacement:', err)
    res.status(500).json({ error: 'Không thể tải tệp thay thế.' })
  }
}

// DELETE /tender/checklist/file/:fileId/replacement — gỡ 1 file thay thế (bản gốc hiện lại).
export async function deleteReplacement(req, res) {
  const fileId = parseInt(req.params.fileId)
  try {
    const { rows } = await pool.query(
      'SELECT file_path, replaces_file_id FROM document_file WHERE id = $1', [fileId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tệp.' })
    if (rows[0].replaces_file_id == null) {
      return res.status(400).json({ error: 'Chỉ gỡ được tệp đánh dấu thay thế.' })
    }
    try {
      const abs = path.join(UPLOADS_ROOT, String(rows[0].file_path).replace(/^\/uploads\//, ''))
      if (fs.existsSync(abs)) fs.unlinkSync(abs)
    } catch { /* best-effort disk cleanup */ }
    await pool.query('DELETE FROM document_file WHERE id = $1', [fileId])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteReplacement:', err)
    res.status(500).json({ error: 'Không thể gỡ tệp thay thế.' })
  }
}
