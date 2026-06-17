// Controller vòng đời đơn đề xuất.
// Phase 3: tạo nháp / sửa nháp / gửi (snapshot chuỗi bước) / danh sách / chi tiết / hủy / xóa / inbox.
// Phase 5 bổ sung approve/reject (file riêng: approvalDecisionController.js).
import { pool } from '../db.js'
import { notifyAction, notifyInfo } from '../services/notify.js'

// SELECT dùng chung cho danh sách đơn (join loại đơn + người gửi).
const LIST_SELECT = `
  SELECT r.id, r.form_id, r.requester_id, r.title, r.status, r.current_step,
         r.submitted_at, r.completed_at, r.created_at, r.updated_at,
         r.deleted_at, r.deleted_by, r.deleted_reason,
         f.name AS form_name, f.icon AS form_icon, f.code AS form_code,
         u.full_name AS requester_name,
         du.full_name AS deleted_by_name,
         (SELECT name FROM approval_request_step s
           WHERE s.request_id = r.id AND s.step_order = r.current_step LIMIT 1) AS current_step_name,
         (SELECT COUNT(*) FROM approval_request_attachment a WHERE a.request_id = r.id)::int AS attachment_count
    FROM approval_request r
    JOIN approval_form f ON f.id = r.form_id
    LEFT JOIN app_user u ON u.id = r.requester_id
    LEFT JOIN app_user du ON du.id = r.deleted_by
`

// ── Đơn của tôi ───────────────────────────────────────────────────────────────
export async function getMyRequests(req, res) {
  try {
    const { rows } = await pool.query(
      `${LIST_SELECT} WHERE r.requester_id = $1 ORDER BY r.created_at DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('getMyRequests:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đơn.' })
  }
}

// ── Admin: TẤT CẢ đề xuất (đã gửi), kèm phòng ban người gửi, gồm cả đơn đã xóa ─
// Phục vụ tab quản trị để tìm & xử lý (xóa/khôi phục) bất kỳ đơn nào. Bỏ qua nháp
// (nháp là riêng tư của người tạo). Lọc chi tiết để frontend tự làm phía client.
export async function getAllRequests(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.form_id, r.requester_id, r.title, r.status, r.current_step,
              r.submitted_at, r.completed_at, r.created_at, r.updated_at,
              r.deleted_at, r.deleted_by, r.deleted_reason,
              f.name AS form_name, f.icon AS form_icon, f.code AS form_code,
              u.full_name AS requester_name,
              dept.name AS requester_dept,
              du.full_name AS deleted_by_name,
              (SELECT name FROM approval_request_step s
                WHERE s.request_id = r.id AND s.step_order = r.current_step LIMIT 1) AS current_step_name
         FROM approval_request r
         JOIN approval_form f ON f.id = r.form_id
    LEFT JOIN app_user u ON u.id = r.requester_id
    LEFT JOIN department dept ON dept.id = u.department_id
    LEFT JOIN app_user du ON du.id = r.deleted_by
        WHERE r.status <> 'draft'
        ORDER BY r.created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error('getAllRequests:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đề xuất.' })
  }
}

// ── Đơn đang chờ CHÍNH TÔI duyệt (bước hiện tại) ─────────────────────────────
export async function getInbox(req, res) {
  try {
    const { rows } = await pool.query(
      `${LIST_SELECT}
        WHERE r.status = 'pending'
          AND r.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM approval_request_step s
              JOIN approval_request_step_approver sa ON sa.step_id = s.id
             WHERE s.request_id = r.id
               AND s.step_order = r.current_step
               AND s.status = 'pending'
               AND sa.approver_id = $1
               AND sa.decision = 'pending'
          )
        ORDER BY r.submitted_at ASC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('getInbox:', err)
    res.status(500).json({ error: 'Không thể tải danh sách chờ duyệt.' })
  }
}

// ── Đơn SẮP đến lượt tôi (tôi là người duyệt ở một bước SAU bước hiện tại) ────
export async function getUpcoming(req, res) {
  try {
    const { rows } = await pool.query(
      `${LIST_SELECT}
        WHERE r.status = 'pending'
          AND r.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM approval_request_step s
              JOIN approval_request_step_approver sa ON sa.step_id = s.id
             WHERE s.request_id = r.id
               AND s.step_order > r.current_step
               AND sa.approver_id = $1
          )
        ORDER BY r.submitted_at ASC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('getUpcoming:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đơn sắp đến lượt.' })
  }
}

// ── Đơn TÔI THEO DÕI (là follower, mọi trạng thái) ───────────────────────────
export async function getFollowing(req, res) {
  try {
    const { rows } = await pool.query(
      `${LIST_SELECT}
        WHERE EXISTS (
          SELECT 1 FROM approval_request_follower fl
           WHERE fl.request_id = r.id AND fl.user_id = $1
        )
        ORDER BY r.created_at DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('getFollowing:', err)
    res.status(500).json({ error: 'Không thể tải danh sách đơn theo dõi.' })
  }
}

// ── Chi tiết một đơn (kèm định nghĩa trường, bước snapshot, sự kiện) ──────────
export async function getRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rows } = await pool.query(`${LIST_SELECT} WHERE r.id = $1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đơn.' })
    const reqRow = rows[0]
    reqRow.form_data = (await pool.query(`SELECT form_data FROM approval_request WHERE id = $1`, [id])).rows[0].form_data

    // Quyền xem: người gửi, người duyệt ở bất kỳ bước nào, người theo dõi, hoặc admin.
    let allowed = Number(req.user.role) === 1 || reqRow.requester_id === req.user.id
    if (!allowed) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM approval_request_step s
           JOIN approval_request_step_approver sa ON sa.step_id = s.id
          WHERE s.request_id = $1 AND sa.approver_id = $2 LIMIT 1`,
        [id, req.user.id]
      )
      allowed = rowCount > 0
    }
    if (!allowed) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM approval_request_follower WHERE request_id = $1 AND user_id = $2 LIMIT 1`,
        [id, req.user.id]
      )
      allowed = rowCount > 0
    }
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền xem đơn này.' })

    // Định nghĩa trường (để render nhãn theo thứ tự).
    const { rows: fields } = await pool.query(
      `SELECT field_key, label, field_type, options, is_required, sort_order
         FROM approval_form_field WHERE form_id = $1 ORDER BY sort_order, id`,
      [reqRow.form_id]
    )
    // Bước snapshot + người duyệt.
    const { rows: steps } = await pool.query(
      `SELECT id, step_order, name, rule, status, approver_source, decided_at
         FROM approval_request_step WHERE request_id = $1 ORDER BY step_order`,
      [id]
    )
    const { rows: approvers } = await pool.query(
      `SELECT sa.id, sa.step_id, sa.approver_id, sa.decision, sa.comment, sa.decided_at,
              u.full_name AS approver_name
         FROM approval_request_step_approver sa
         JOIN approval_request_step s ON s.id = sa.step_id
    LEFT JOIN app_user u ON u.id = sa.approver_id
        WHERE s.request_id = $1 ORDER BY sa.id`,
      [id]
    )
    const stepsFull = steps.map(s => ({ ...s, approvers: approvers.filter(a => a.step_id === s.id) }))
    // Người theo dõi (snapshot lúc gửi).
    const { rows: followers } = await pool.query(
      `SELECT fl.user_id, u.full_name
         FROM approval_request_follower fl
         JOIN app_user u ON u.id = fl.user_id
        WHERE fl.request_id = $1 ORDER BY u.full_name, fl.user_id`,
      [id]
    )
    // Đính kèm.
    const { rows: attachments } = await pool.query(
      `SELECT id, file_name, file_path, file_size, mime_type, created_at
         FROM approval_request_attachment WHERE request_id = $1 ORDER BY id`,
      [id]
    )
    // Sự kiện timeline.
    const { rows: events } = await pool.query(
      `SELECT e.id, e.event_type, e.detail, e.created_at, u.full_name AS actor_name
         FROM approval_request_event e
    LEFT JOIN app_user u ON u.id = e.actor_id
        WHERE e.request_id = $1 ORDER BY e.id`,
      [id]
    )
    res.json({ ...reqRow, fields, steps: stepsFull, followers, attachments, events })
  } catch (err) {
    console.error('getRequest:', err)
    res.status(500).json({ error: 'Không thể tải chi tiết đơn.' })
  }
}

// ── Tạo đơn nháp ──────────────────────────────────────────────────────────────
export async function createRequest(req, res) {
  const { form_id, title, form_data } = req.body
  const formId = parseInt(form_id, 10)
  if (!Number.isInteger(formId)) return res.status(400).json({ error: 'Thiếu loại đơn.' })
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống.' })
  try {
    const { rows: forms } = await pool.query(
      `SELECT id FROM approval_form WHERE id = $1 AND is_active = true`, [formId]
    )
    if (!forms.length) return res.status(400).json({ error: 'Loại đơn không tồn tại hoặc đã ngừng dùng.' })

    // Chặn theo phòng ban: loại đơn có giới hạn chỉ cho nhân sự thuộc phòng ban đó tạo.
    // (Admin được bỏ qua giới hạn để cấu hình/kiểm thử.)
    if (Number(req.user.role) !== 1) {
      const { rows: allowed } = await pool.query(
        `SELECT 1 FROM approval_form f
          WHERE f.id = $1
            AND ( NOT EXISTS (SELECT 1 FROM approval_form_department d WHERE d.form_id = f.id)
               OR EXISTS (
                    SELECT 1 FROM approval_form_department d
                      JOIN app_user u ON u.id = $2
                     WHERE d.form_id = f.id AND d.department_id = u.department_id) )
          LIMIT 1`,
        [formId, req.user.id]
      )
      if (!allowed.length) return res.status(403).json({ error: 'Phòng ban của bạn không được phép dùng loại đơn này.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO approval_request (form_id, requester_id, title, status, form_data)
       VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
      [formId, req.user.id, title.trim(), JSON.stringify(form_data || {})]
    )
    res.status(201).json({ id: rows[0].id })
  } catch (err) {
    console.error('createRequest:', err)
    res.status(500).json({ error: 'Không thể tạo đơn.' })
  }
}

// ── Sửa đơn nháp ──────────────────────────────────────────────────────────────
export async function updateRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const { title, form_data } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống.' })
  try {
    const { rows } = await pool.query(
      `UPDATE approval_request SET title = $1, form_data = $2, updated_at = now()
        WHERE id = $3 AND requester_id = $4 AND status = 'draft' AND deleted_at IS NULL RETURNING id`,
      [title.trim(), JSON.stringify(form_data || {}), id, req.user.id]
    )
    if (!rows.length) return res.status(403).json({ error: 'Chỉ sửa được đơn nháp của chính bạn.' })
    res.json({ success: true })
  } catch (err) {
    console.error('updateRequest:', err)
    res.status(500).json({ error: 'Không thể cập nhật đơn.' })
  }
}

// ── Gửi đơn: nháp → chờ duyệt, CHỤP chuỗi bước từ cấu hình loại đơn ───────────
export async function submitRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: reqs } = await client.query(
      `SELECT id, form_id, title, form_data FROM approval_request
        WHERE id = $1 AND requester_id = $2 AND status = 'draft' AND deleted_at IS NULL FOR UPDATE`,
      [id, req.user.id]
    )
    if (!reqs.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Chỉ gửi được đơn nháp của chính bạn.' }) }
    const reqRow = reqs[0]

    // Kiểm tra trường bắt buộc.
    const { rows: fields } = await client.query(
      `SELECT field_key, label, is_required FROM approval_form_field WHERE form_id = $1`, [reqRow.form_id]
    )
    const data = reqRow.form_data || {}
    const missing = fields.filter(f => {
      if (!f.is_required) return false
      const v = data[f.field_key]
      return v == null || v === '' || (Array.isArray(v) && v.length === 0)
    })
    if (missing.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `Thiếu trường bắt buộc: ${missing.map(m => m.label).join(', ')}` })
    }

    // Lấy chuỗi bước + người duyệt từ cấu hình.
    const { rows: cfgSteps } = await client.query(
      `SELECT id, step_order, name, rule, approver_source FROM approval_form_step WHERE form_id = $1 ORDER BY step_order`,
      [reqRow.form_id]
    )
    if (!cfgSteps.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Loại đơn chưa cấu hình bước duyệt.' }) }

    const { rows: cfgApprovers } = await client.query(
      `SELECT sa.step_id, sa.approver_type, sa.approver_ref
         FROM approval_form_step_approver sa
         JOIN approval_form_step s ON s.id = sa.step_id
        WHERE s.form_id = $1`,
      [reqRow.form_id]
    )

    // Quản lý trực tiếp của người gửi (cho nguồn 'direct_manager').
    const managerId = (await client.query(`SELECT manager_id FROM app_user WHERE id = $1`, [req.user.id])).rows[0]?.manager_id || null
    // Người duyệt do người gửi tự chọn, map theo id bước cấu hình (cho nguồn 'requester_pick').
    const picked = req.body?.stepApprovers || {}

    // Chụp snapshot từng bước (đánh lại step_order liên tục 1..n).
    let firstStepOrder = null
    let firstStepApprovers = []
    for (let i = 0; i < cfgSteps.length; i++) {
      const cs = cfgSteps[i]
      const order = i + 1
      const source = cs.approver_source || 'fixed'
      if (firstStepOrder === null) firstStepOrder = order

      // Phân giải người duyệt theo nguồn.
      let approverIds = []
      if (source === 'fixed') {
        approverIds = resolveApprovers(cfgApprovers.filter(a => a.step_id === cs.id))
      } else if (source === 'direct_manager') {
        if (!managerId) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: `Bước "${cs.name}" cần quản lý trực tiếp, nhưng tài khoản của bạn chưa được gán quản lý.` })
        }
        approverIds = [managerId]
      } else if (source === 'requester_pick') {
        approverIds = normalizeIds(picked[cs.id] || picked[String(cs.id)])
        if (!approverIds.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: `Bạn cần chọn người duyệt cho bước "${cs.name}".` })
        }
      }
      if (!approverIds.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Bước "${cs.name}" chưa có người duyệt hợp lệ.` })
      }

      const { rows: stepRows } = await client.query(
        `INSERT INTO approval_request_step (request_id, step_order, name, rule, status, approver_source)
         VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING id`,
        [id, order, cs.name, cs.rule, source]
      )
      const stepId = stepRows[0].id
      if (i === 0) firstStepApprovers = approverIds
      for (const uid of approverIds) {
        await client.query(
          `INSERT INTO approval_request_step_approver (step_id, approver_id, decision)
           VALUES ($1, $2, 'pending')`,
          [stepId, uid]
        )
      }
    }

    // CHỤP người theo dõi từ cấu hình loại đơn (admin định sẵn; người gửi không sửa).
    const { rows: cfgFollowers } = await client.query(
      `SELECT user_id FROM approval_form_follower WHERE form_id = $1`, [reqRow.form_id]
    )
    const followerIds = [...new Set(cfgFollowers.map(f => Number(f.user_id)).filter(Boolean))]
    for (const uid of followerIds) {
      await client.query(
        `INSERT INTO approval_request_follower (request_id, user_id) VALUES ($1, $2)
         ON CONFLICT (request_id, user_id) DO NOTHING`,
        [id, uid]
      )
    }

    await client.query(
      `UPDATE approval_request SET status = 'pending', current_step = $1, submitted_at = now(), updated_at = now()
        WHERE id = $2`,
      [firstStepOrder, id]
    )
    await client.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type) VALUES ($1, $2, 'submitted')`,
      [id, req.user.id]
    )
    await client.query('COMMIT')

    // Thông báo người duyệt bước đầu (fire-and-forget, sau commit).
    if (firstStepApprovers.length) {
      notifyAction(firstStepApprovers, `Bạn có đơn cần duyệt: ${reqRow.title}`)
    }
    // Báo người theo dõi có đơn mới (chỉ để nắm thông tin).
    if (followerIds.length) {
      notifyInfo(followerIds, `Có đề xuất mới bạn đang theo dõi: ${reqRow.title}`)
    }
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('submitRequest:', err)
    res.status(500).json({ error: 'Không thể gửi đơn.' })
  } finally {
    client.release()
  }
}

// Chuẩn hóa mảng id (số hoặc chuỗi) → mảng số nguyên duy nhất.
function normalizeIds(arr) {
  if (!Array.isArray(arr)) return []
  const out = []
  for (const x of arr) {
    const n = parseInt(x, 10)
    if (Number.isInteger(n) && !out.includes(n)) out.push(n)
  }
  return out
}

// MVP: chỉ phân giải người duyệt kiểu 'user' (ref = id). 'position'/'department_head' để mở rộng sau.
function resolveApprovers(approvers) {
  const ids = []
  for (const a of approvers) {
    if (a.approver_type === 'user') {
      const uid = parseInt(a.approver_ref, 10)
      if (Number.isInteger(uid) && !ids.includes(uid)) ids.push(uid)
    }
  }
  return ids
}

// ── Hủy đơn đang chờ duyệt (người gửi) ───────────────────────────────────────
export async function cancelRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rows } = await pool.query(
      `UPDATE approval_request SET status = 'cancelled', completed_at = now(), updated_at = now()
        WHERE id = $1 AND requester_id = $2 AND status = 'pending' AND deleted_at IS NULL RETURNING id`,
      [id, req.user.id]
    )
    if (!rows.length) return res.status(403).json({ error: 'Chỉ hủy được đơn đang chờ duyệt của chính bạn.' })
    await pool.query(
      `INSERT INTO approval_request_event (request_id, actor_id, event_type) VALUES ($1, $2, 'cancelled')`,
      [id, req.user.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('cancelRequest:', err)
    res.status(500).json({ error: 'Không thể hủy đơn.' })
  }
}

// ── Xóa đơn nháp (người gửi) ──────────────────────────────────────────────────
export async function deleteRequest(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM approval_request WHERE id = $1 AND requester_id = $2 AND status = 'draft'`,
      [id, req.user.id]
    )
    if (!rowCount) return res.status(403).json({ error: 'Chỉ xóa được đơn nháp của chính bạn.' })
    res.json({ success: true })
  } catch (err) {
    console.error('deleteRequest:', err)
    res.status(500).json({ error: 'Không thể xóa đơn.' })
  }
}
