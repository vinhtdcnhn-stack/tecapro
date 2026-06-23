import fs from 'fs'
import { pool } from '../db.js'
import { notifyAction } from '../services/notify.js'
import { logActivity } from './tenderController.js'

// ──────────────────────────────────────────────────────────────────────────────
// Review & Versioning (GĐ3). Người làm thầu trình hồ sơ qua các phiên bản; Trưởng
// phòng review, kết luận Đạt (→ Sẵn sàng in/ký) hoặc Chưa đạt (→ trả về sửa).
// ──────────────────────────────────────────────────────────────────────────────

// Trả về các phiên bản (mới → cũ) kèm các vòng review của từng phiên bản.
export async function getReviewData(req, res) {
  const tenderId = parseInt(req.params.id)
  try {
    const { rows: versions } = await pool.query(
      `SELECT v.id, v.version_no, v.file_name, v.file_size, v.mime_type, v.note,
              v.uploaded_by, u.full_name AS uploaded_by_name, v.created_at
         FROM tender_document_version v
         LEFT JOIN app_user u ON u.id = v.uploaded_by
        WHERE v.tender_id = $1
        ORDER BY v.version_no DESC`,
      [tenderId],
    )
    const { rows: reviews } = await pool.query(
      `SELECT r.id, r.version_id, r.conclusion, r.comment, r.created_at,
              r.reviewer_id, u.full_name AS reviewer_name
         FROM tender_review r
         LEFT JOIN app_user u ON u.id = r.reviewer_id
        WHERE r.tender_id = $1
        ORDER BY r.created_at DESC`,
      [tenderId],
    )
    const byVersion = new Map()
    for (const rv of reviews) {
      const k = String(rv.version_id)
      if (!byVersion.has(k)) byVersion.set(k, [])
      byVersion.get(k).push(rv)
    }
    res.json(versions.map(v => ({ ...v, reviews: byVersion.get(String(v.id)) || [] })))
  } catch (err) {
    console.error('getReviewData:', err)
    res.status(500).json({ error: 'Không thể tải dữ liệu review.' })
  }
}

// Người làm thầu trình hồ sơ (tải lên 1 phiên bản mới) → trạng thái "Chờ review".
export async function submitVersion(req, res) {
  const tenderId = parseInt(req.params.id)
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp hồ sơ.' })
  const note = String(req.body?.note ?? '').trim() || null
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  try {
    const { rows: maxv } = await pool.query(
      'SELECT COALESCE(MAX(version_no), 0) + 1 AS n FROM tender_document_version WHERE tender_id = $1',
      [tenderId],
    )
    const versionNo = maxv[0].n
    const filePath = `/uploads/tender-versions/${tenderId}/${req.file.filename}`
    const { rows } = await pool.query(
      `INSERT INTO tender_document_version
         (tender_id, version_no, file_name, file_path, file_size, mime_type, note, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [tenderId, versionNo, name, filePath, req.file.size, req.file.mimetype, note, req.user.id],
    )
    await pool.query(
      "UPDATE tender SET workflow_status = 'Chờ review', updated_at = now() WHERE id = $1", [tenderId])
    logActivity(tenderId, req.user.id, 'review', `Trình hồ sơ review v${versionNo}`)

    // Báo các Trưởng phòng (HEAD) để review.
    const { rows: heads } = await pool.query(
      "SELECT user_id FROM tender_member WHERE department_id = 9 AND is_active AND dept_role = 'HEAD'")
    const { rows: t } = await pool.query('SELECT package_name FROM tender WHERE id = $1', [tenderId])
    const headIds = heads.map(h => Number(h.user_id)).filter(id => id !== req.user.id)
    if (headIds.length) {
      notifyAction(headIds, `Hồ sơ gói thầu "${t[0]?.package_name || `#${tenderId}`}" (v${versionNo}) chờ bạn review`)
    }
    res.status(201).json({ success: true, id: rows[0].id, version_no: versionNo })
  } catch (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path) } catch { /* noop */ } }
    console.error('submitVersion:', err)
    res.status(500).json({ error: 'Không thể trình hồ sơ.' })
  }
}

// Trưởng phòng kết luận review một phiên bản: Đạt → "Sẵn sàng in/ký"; Chưa đạt → "Chưa đạt".
export async function decideReview(req, res) {
  const versionId = parseInt(req.params.versionId)
  const conclusion = String(req.body?.conclusion ?? '').trim()
  const comment = String(req.body?.comment ?? '').trim() || null
  if (!['pass', 'fail'].includes(conclusion)) {
    return res.status(400).json({ error: 'Kết luận không hợp lệ.' })
  }
  if (conclusion === 'fail' && !comment) {
    return res.status(400).json({ error: 'Cần ghi lý do khi kết luận Chưa đạt.' })
  }
  try {
    const { rows: v } = await pool.query(
      `SELECT v.tender_id, v.version_no, t.package_name, t.bid_maker_id
         FROM tender_document_version v JOIN tender t ON t.id = v.tender_id
        WHERE v.id = $1`,
      [versionId],
    )
    if (!v.length) return res.status(404).json({ error: 'Không tìm thấy phiên bản hồ sơ.' })
    const { tender_id, version_no, package_name, bid_maker_id } = v[0]

    await pool.query(
      `INSERT INTO tender_review (tender_id, version_id, reviewer_id, conclusion, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [tender_id, versionId, req.user.id, conclusion, comment],
    )
    const newStatus = conclusion === 'pass' ? 'Sẵn sàng in/ký' : 'Chưa đạt'
    await pool.query(
      'UPDATE tender SET workflow_status = $1, updated_at = now() WHERE id = $2', [newStatus, tender_id])
    logActivity(tender_id, req.user.id, 'review',
      `Review v${version_no}: ${conclusion === 'pass' ? 'ĐẠT' : 'CHƯA ĐẠT'}${comment ? ` — ${comment}` : ''}`)

    // Báo người làm thầu kết quả review.
    if (bid_maker_id && Number(bid_maker_id) !== req.user.id) {
      if (conclusion === 'pass') {
        notifyAction([bid_maker_id], `Hồ sơ "${package_name}" (v${version_no}) đã ĐẠT — sẵn sàng in/ký`)
      } else {
        notifyAction([bid_maker_id], `Hồ sơ "${package_name}" (v${version_no}) bị trả lại (Chưa đạt): ${comment}`)
      }
    }
    res.json({ success: true })
  } catch (err) {
    console.error('decideReview:', err)
    res.status(500).json({ error: 'Không thể lưu kết luận review.' })
  }
}
