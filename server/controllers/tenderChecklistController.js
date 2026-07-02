import { pool } from '../db.js'
import { notifyAction, notifyInfo, fmtDate } from '../services/notify.js'
import { logActivity } from './tenderController.js'
import { userIsHead, userIsBidMakerOfItem } from '../middleware/tenderAccess.js'
import { cacheWrap } from '../cache.js'
import { tenderKey, tenderTabNotModified, invalidateTender } from '../services/cacheKeys.js'

const CHECKLIST_TTL = 5 * 60 // 5'

// ──────────────────────────────────────────────────────────────────────────────
// Checklist công việc của gói thầu (GĐ2). Đầu việc → phòng ban → người phụ trách,
// có việc con (parent_item_id), trạng thái, tệp sản phẩm. Module Ban Đấu thầu.
// ──────────────────────────────────────────────────────────────────────────────

const STATUSES = new Set(['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy'])

const ITEM_COLS = `
  i.id, i.tender_id, i.title, i.description, i.department_id, d.name AS department_name,
  i.assignee_id, u.full_name AS assignee_name, i.due_date, i.status,
  i.parent_item_id, i.sort_order, i.completed_at, i.created_at,
  i.rework_count, i.rework_reason, i.review_status, i.review_comment,
  (SELECT count(*)::int FROM document_file df WHERE df.item_id = i.id) AS attachment_count`

// Nhãn gói thầu cho thông báo.
async function tenderLabel(tenderId) {
  const { rows } = await pool.query('SELECT package_name FROM tender WHERE id = $1', [tenderId])
  return rows[0]?.package_name || `#${tenderId}`
}

export async function getChecklist(req, res) {
  const tenderId = parseInt(req.params.id)
  try {
    if (await tenderTabNotModified(req, res, tenderId, 'checklist')) return
    const rows = await cacheWrap(tenderKey(tenderId, 'checklist'), CHECKLIST_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT ${ITEM_COLS}
           FROM tender_checklist_item i
           LEFT JOIN department d ON d.id = i.department_id
           LEFT JOIN app_user u ON u.id = i.assignee_id
          WHERE i.tender_id = $1
          ORDER BY i.parent_item_id NULLS FIRST, i.sort_order, i.id`,
        [tenderId],
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getChecklist:', err)
    res.status(500).json({ error: 'Không thể tải checklist.' })
  }
}

// GET /tender/my-task/:itemId — màn hình "Việc đấu thầu của tôi" cho người được giao
// (không là thành viên Ban Đấu thầu). Trả thông tin đầu việc + gói thầu cho phần đầu
// trang. Tệp sản phẩm và Hồ sơ mời thầu được tải riêng qua các route docs/invitation
// (trình quản lý thư mục/tệp), không gói trong response này nữa.
export async function getMyTask(req, res) {
  const itemId = parseInt(req.params.itemId)
  try {
    const { rows: itemRows } = await pool.query(
      `SELECT i.id, i.tender_id, i.title, i.description, i.due_date, i.status,
              i.rework_count, i.rework_reason,
              d.name AS department_name, u.full_name AS assignee_name,
              t.package_name, t.package_code, t.investor
         FROM tender_checklist_item i
         JOIN tender t ON t.id = i.tender_id
         LEFT JOIN department d ON d.id = i.department_id
         LEFT JOIN app_user u ON u.id = i.assignee_id
        WHERE i.id = $1`,
      [itemId],
    )
    if (!itemRows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    // can_manage: được mở lại trạng thái khi đã 'Hoàn thành' (Trưởng phòng / người làm thầu).
    const canManage = await userIsHead(req.user.id, req.user.role)
      || await userIsBidMakerOfItem(itemId, req.user.id)
    res.json({ item: { ...itemRows[0], can_manage: canManage } })
  } catch (err) {
    console.error('getMyTask:', err)
    res.status(500).json({ error: 'Không thể tải công việc.' })
  }
}

export async function createItem(req, res) {
  const tenderId = parseInt(req.params.id)
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Tên đầu việc không được để trống.' })
  const departmentId = req.body?.department_id ? parseInt(req.body.department_id) : null
  const assigneeId = req.body?.assignee_id ? parseInt(req.body.assignee_id) : null
  const parentId = req.body?.parent_item_id ? parseInt(req.body.parent_item_id) : null
  const dueDate = String(req.body?.due_date ?? '').trim() || null
  const description = String(req.body?.description ?? '').trim() || null
  try {
    const { rows: ord } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM tender_checklist_item
        WHERE tender_id = $1 AND parent_item_id IS NOT DISTINCT FROM $2`,
      [tenderId, parentId],
    )
    const { rows } = await pool.query(
      `INSERT INTO tender_checklist_item
         (tender_id, title, description, department_id, assignee_id, due_date, parent_item_id, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [tenderId, title, description, departmentId, assigneeId, dueDate, parentId, ord[0].n, req.user.id],
    )
    const id = rows[0].id
    invalidateTender(tenderId, 'checklist')
    logActivity(tenderId, req.user.id, 'update', `Thêm đầu việc "${title}"`)
    if (assigneeId && assigneeId !== req.user.id) {
      const label = await tenderLabel(tenderId)
      const han = dueDate ? `\nHạn: ${fmtDate(dueDate)}` : ''
      notifyAction([assigneeId], `Bạn được giao đầu việc: "${title}" — Gói thầu ${label}${han}`)
    }
    res.status(201).json({ success: true, id })
  } catch (err) {
    console.error('createItem:', err)
    res.status(500).json({ error: 'Không thể tạo đầu việc.' })
  }
}

export async function updateItem(req, res) {
  const id = parseInt(req.params.itemId)
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Tên đầu việc không được để trống.' })
  const departmentId = req.body?.department_id ? parseInt(req.body.department_id) : null
  const assigneeId = req.body?.assignee_id ? parseInt(req.body.assignee_id) : null
  const dueDate = String(req.body?.due_date ?? '').trim() || null
  const description = String(req.body?.description ?? '').trim() || null
  try {
    const { rows: cur } = await pool.query(
      'SELECT tender_id, assignee_id, title, review_status FROM tender_checklist_item WHERE id = $1', [id])
    if (!cur.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    if (cur[0].review_status === 'approved') {
      return res.status(403).json({ error: 'Đầu việc đã được duyệt — không thể sửa. Trưởng ban cần thu hồi kết luận trước.' })
    }

    const { rows } = await pool.query(
      `UPDATE tender_checklist_item SET
         title=$1, description=$2, department_id=$3, assignee_id=$4, due_date=$5, updated_at=now()
       WHERE id=$6 RETURNING id`,
      [title, description, departmentId, assigneeId, dueDate, id],
    )
    invalidateTender(cur[0].tender_id, 'checklist')
    logActivity(cur[0].tender_id, req.user.id, 'update', `Sửa đầu việc "${title}"`)
    if (assigneeId && assigneeId !== cur[0].assignee_id && assigneeId !== req.user.id) {
      const label = await tenderLabel(cur[0].tender_id)
      const han = dueDate ? `\nHạn: ${fmtDate(dueDate)}` : ''
      notifyAction([assigneeId], `Bạn được giao đầu việc: "${title}" — Gói thầu ${label}${han}`)
    }
    res.json({ success: true, id: rows[0].id })
  } catch (err) {
    console.error('updateItem:', err)
    res.status(500).json({ error: 'Không thể cập nhật đầu việc.' })
  }
}

export async function updateItemStatus(req, res) {
  const id = parseInt(req.params.itemId)
  const status = String(req.body?.status ?? '').trim()
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  const reason = String(req.body?.reason ?? '').trim()
  try {
    const { rows: cur } = await pool.query(
      'SELECT tender_id, title, created_by, assignee_id, status, rework_count, review_status FROM tender_checklist_item WHERE id = $1', [id])
    if (!cur.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    // Đầu việc đã duyệt Đạt bị khoá: không đổi trạng thái cho tới khi Trưởng ban thu hồi kết luận.
    if (cur[0].review_status === 'approved' && status !== cur[0].status) {
      return res.status(403).json({ error: 'Đầu việc đã được duyệt — không thể đổi trạng thái. Trưởng ban cần thu hồi kết luận trước.' })
    }
    // Mở khoá trạng thái: thoát khỏi 'Hoàn thành' chỉ dành cho Trưởng phòng Kế hoạch
    // Đấu thầu hoặc người làm thầu (nhân viên được giao phụ trách) gói này.
    if (cur[0].status === 'Hoàn thành' && status !== 'Hoàn thành') {
      const canUnlock = await userIsHead(req.user.id, req.user.role)
        || await userIsBidMakerOfItem(id, req.user.id)
      if (!canUnlock) {
        return res.status(403).json({
          error: 'Đầu việc đã hoàn thành — chỉ Trưởng phòng Kế hoạch Đấu thầu hoặc người làm thầu của gói mới được mở lại trạng thái.',
        })
      }
    }
    // Yêu cầu LÀM LẠI: 'Hoàn thành' → 'Đang thực hiện'. Bắt buộc kèm lý do, tăng số
    // lần sửa và lưu lý do để hiển thị trong form làm việc của người nhận.
    const isRework = cur[0].status === 'Hoàn thành' && status === 'Đang thực hiện'
    if (isRework && !reason) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do yêu cầu làm lại.' })
    }
    const reworkCount = isRework ? Number(cur[0].rework_count || 0) + 1 : Number(cur[0].rework_count || 0)
    if (isRework) {
      await pool.query(
        `UPDATE tender_checklist_item
            SET status=$1, completed_at=NULL, rework_count=$2, rework_reason=$3, updated_at=now()
          WHERE id=$4`,
        [status, reworkCount, reason, id],
      )
    } else {
      const completedAt = status === 'Hoàn thành' ? 'now()' : 'NULL'
      await pool.query(
        `UPDATE tender_checklist_item SET status=$1, completed_at=${completedAt}, updated_at=now() WHERE id=$2`,
        [status, id],
      )
    }
    invalidateTender(cur[0].tender_id, 'checklist')
    logActivity(cur[0].tender_id, req.user.id, 'status',
      isRework
        ? `Yêu cầu làm lại (lần ${reworkCount}) đầu việc "${cur[0].title}": ${reason}`
        : `Đầu việc "${cur[0].title}" → ${status}`)
    if (isRework) {
      // Báo người được giao: cần xử lý → notifyAction (🔔 + đậm).
      if (cur[0].assignee_id && cur[0].assignee_id !== req.user.id) {
        notifyAction([cur[0].assignee_id],
          `🔁 Yêu cầu làm lại (lần ${reworkCount}) đầu việc "${cur[0].title}"\nLý do: ${reason}`)
      }
    } else if (cur[0].created_by && cur[0].created_by !== req.user.id) {
      // Báo người làm thầu (created_by) khi người được giao cập nhật.
      notifyInfo([cur[0].created_by], `Đầu việc "${cur[0].title}" đã chuyển sang: ${status}`)
    }
    res.json({ success: true, id })
  } catch (err) {
    console.error('updateItemStatus:', err)
    res.status(500).json({ error: 'Không thể cập nhật trạng thái.' })
  }
}

export async function deleteItem(req, res) {
  const id = parseInt(req.params.itemId)
  try {
    const { rows: cur } = await pool.query(
      'SELECT review_status FROM tender_checklist_item WHERE id = $1', [id])
    if (!cur.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    if (cur[0].review_status === 'approved') {
      return res.status(403).json({ error: 'Đầu việc đã được duyệt — không thể xoá. Trưởng ban cần thu hồi kết luận trước.' })
    }
    const { rows } = await pool.query(
      'DELETE FROM tender_checklist_item WHERE id = $1 RETURNING tender_id, title', [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
    invalidateTender(rows[0].tender_id, 'checklist')
    logActivity(rows[0].tender_id, req.user.id, 'update', `Xoá đầu việc "${rows[0].title}"`)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteItem:', err)
    res.status(500).json({ error: 'Không thể xoá đầu việc.' })
  }
}
