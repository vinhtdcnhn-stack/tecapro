// Controller cấu hình loại đơn / form builder (chỉ admin).
// Quản lý approval_form + các trường (approval_form_field), chuỗi bước duyệt
// (approval_form_step) và người duyệt cấu hình cho từng bước (approval_form_step_approver).
import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { lookupKey, approvalFormOptsKey, invalidateApprovalForms, lookupNotModified } from '../services/cacheKeys.js'

const FORMS_TTL = 12 * 60 * 60     // 12h — admin cấu hình ít đổi
const FORM_OPTS_TTL = 6 * 60 * 60  // 6h

const FIELD_TYPES = new Set([
  'text', 'textarea', 'number', 'money', 'date', 'date_range',
  'select', 'checkbox', 'user', 'file', 'table',
])
const STEP_RULES = new Set(['any', 'all'])
const APPROVER_TYPES = new Set(['user', 'position', 'department_head'])
const APPROVER_SOURCES = new Set(['fixed', 'direct_manager', 'requester_pick'])
const CONDITION_MODES = new Set(['always', 'include', 'exclude'])

// ── Danh sách loại đơn ────────────────────────────────────────────────────────
export async function getForms(req, res) {
  try {
    if (await lookupNotModified(req, res, 'approval-forms')) return
    const rows = await cacheWrap(lookupKey('approval-forms'), FORMS_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT f.id, f.code, f.name, f.description, f.icon, f.is_active, f.sort_order,
                (SELECT COUNT(*) FROM approval_form_field ff WHERE ff.form_id = f.id)::int AS field_count,
                (SELECT COUNT(*) FROM approval_form_step fs WHERE fs.form_id = f.id)::int  AS step_count
           FROM approval_form f
          ORDER BY f.sort_order, f.name`
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getForms:', err)
    res.status(500).json({ error: 'Không thể tải danh sách loại đơn.' })
  }
}

// ── Danh sách nhân viên để chọn người duyệt (id + tên + email để lọc) ────────
// Cố ý lộ email phục vụ tìm kiếm khi chọn người duyệt (khác /users vốn ẩn email với non-admin).
export async function getUserOptions(req, res) {
  try {
    if (await lookupNotModified(req, res, 'approval-users')) return
    const rows = await cacheWrap(lookupKey('approval-users'), FORMS_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT id, full_name, email FROM app_user ORDER BY full_name, id`
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getUserOptions:', err)
    res.status(500).json({ error: 'Không thể tải danh sách nhân viên.' })
  }
}

// ── Danh sách loại đơn ĐANG DÙNG mà NGƯỜI DÙNG HIỆN TẠI được phép tạo ─────────
// Lọc theo phòng ban: loại đơn không giới hạn (không có dòng approval_form_department)
// hiện cho mọi người; loại đơn có giới hạn chỉ hiện với nhân sự thuộc phòng ban đó.
// Admin xem được tất cả (để cấu hình/kiểm thử).
export async function getActiveForms(req, res) {
  const isAdmin = Number(req.user.role) === 1
  try {
    // Per-user (lọc theo phòng ban); version-namespace bump khi cấu hình loại đơn đổi.
    const key = await approvalFormOptsKey(`${req.user.id}:${isAdmin ? 'a' : 'u'}`)
    const rows = await cacheWrap(key, FORM_OPTS_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT f.id, f.code, f.name, f.description, f.icon, f.sort_order
           FROM approval_form f
          WHERE f.is_active = true
            AND ( $2::boolean
               OR NOT EXISTS (SELECT 1 FROM approval_form_department d WHERE d.form_id = f.id)
               OR EXISTS (
                    SELECT 1 FROM approval_form_department d
                      JOIN app_user u ON u.id = $1
                     WHERE d.form_id = f.id AND d.department_id = u.department_id) )
          ORDER BY f.sort_order, f.name`,
        [req.user.id, isAdmin]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getActiveForms:', err)
    res.status(500).json({ error: 'Không thể tải danh sách loại đơn.' })
  }
}

// ── Sơ đồ form để render khi tạo đơn (mọi nhân viên): trường + chuỗi duyệt ────
export async function getFormSchema(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rows: forms } = await pool.query(
      `SELECT id, code, name, description, icon, is_active FROM approval_form WHERE id = $1`, [id]
    )
    if (!forms.length) return res.status(404).json({ error: 'Không tìm thấy loại đơn.' })
    const { rows: fields } = await pool.query(
      `SELECT field_key, label, field_type, options, is_required, sort_order, config
         FROM approval_form_field WHERE form_id = $1 ORDER BY sort_order, id`, [id]
    )
    const { rows: steps } = await pool.query(
      `SELECT id, step_order, name, rule, approver_source, condition_mode, condition_positions
         FROM approval_form_step WHERE form_id = $1 ORDER BY step_order, id`, [id]
    )
    const { rows: approvers } = await pool.query(
      `SELECT sa.step_id, u.full_name AS approver_name
         FROM approval_form_step_approver sa
         JOIN approval_form_step s ON s.id = sa.step_id
    LEFT JOIN app_user u ON u.id::text = sa.approver_ref AND sa.approver_type = 'user'
        WHERE s.form_id = $1 ORDER BY sa.id`, [id]
    )
    const stepsFull = steps.map(s => ({
      ...s, approvers: approvers.filter(a => a.step_id === s.id),
    }))
    // Người theo dõi (admin định sẵn) — hiển thị read-only cho người gửi.
    const { rows: followers } = await pool.query(
      `SELECT fl.user_id, u.full_name
         FROM approval_form_follower fl
         JOIN app_user u ON u.id = fl.user_id
        WHERE fl.form_id = $1 ORDER BY u.full_name, fl.user_id`,
      [id]
    )
    res.json({ ...forms[0], fields, steps: stepsFull, followers })
  } catch (err) {
    console.error('getFormSchema:', err)
    res.status(500).json({ error: 'Không thể tải sơ đồ loại đơn.' })
  }
}

// ── Chi tiết một loại đơn (kèm trường + bước + người duyệt) ───────────────────
export async function getForm(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rows: forms } = await pool.query(`SELECT * FROM approval_form WHERE id = $1`, [id])
    if (!forms.length) return res.status(404).json({ error: 'Không tìm thấy loại đơn.' })

    const { rows: fields } = await pool.query(
      `SELECT id, field_key, label, field_type, options, is_required, sort_order, config
         FROM approval_form_field WHERE form_id = $1 ORDER BY sort_order, id`,
      [id]
    )
    const { rows: steps } = await pool.query(
      `SELECT id, step_order, name, rule, approver_source, condition_mode, condition_positions
         FROM approval_form_step WHERE form_id = $1 ORDER BY step_order, id`,
      [id]
    )
    const { rows: approvers } = await pool.query(
      `SELECT sa.id, sa.step_id, sa.approver_type, sa.approver_ref, u.full_name AS approver_name
         FROM approval_form_step_approver sa
         JOIN approval_form_step s ON s.id = sa.step_id
    LEFT JOIN app_user u ON u.id::text = sa.approver_ref AND sa.approver_type = 'user'
        WHERE s.form_id = $1
        ORDER BY sa.id`,
      [id]
    )
    const stepsWithApprovers = steps.map(s => ({
      ...s,
      approvers: approvers.filter(a => a.step_id === s.id),
    }))
    const { rows: followers } = await pool.query(
      `SELECT fl.user_id, u.full_name, u.email
         FROM approval_form_follower fl
         JOIN app_user u ON u.id = fl.user_id
        WHERE fl.form_id = $1 ORDER BY u.full_name, fl.user_id`,
      [id]
    )
    const { rows: departments } = await pool.query(
      `SELECT fd.department_id, d.code, d.name
         FROM approval_form_department fd
         JOIN department d ON d.id = fd.department_id
        WHERE fd.form_id = $1 ORDER BY d.id`,
      [id]
    )
    res.json({ ...forms[0], fields, steps: stepsWithApprovers, followers, departments })
  } catch (err) {
    console.error('getForm:', err)
    res.status(500).json({ error: 'Không thể tải loại đơn.' })
  }
}

// ── Xuất dữ liệu đơn theo loại + khoảng thời gian (admin) ─────────────────────
// Trả JSON { form, fields, rows }; frontend tự dựng file Excel (đồng bộ toàn app).
// Lọc theo created_at (luôn có, gồm cả nháp). from/to là 'yyyy-mm-dd', bao trọn ngày "to".
export async function exportRequests(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const { from, to } = req.query
  const DATE = /^\d{4}-\d{2}-\d{2}$/
  if (!DATE.test(from || '') || !DATE.test(to || '')) {
    return res.status(400).json({ error: 'Khoảng thời gian không hợp lệ.' })
  }
  try {
    const { rows: forms } = await pool.query(
      `SELECT id, code, name FROM approval_form WHERE id = $1`, [id]
    )
    if (!forms.length) return res.status(404).json({ error: 'Không tìm thấy loại đơn.' })

    const { rows: fields } = await pool.query(
      `SELECT field_key, label, field_type, config
         FROM approval_form_field WHERE form_id = $1 ORDER BY sort_order, id`, [id]
    )
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.status, r.current_step, r.form_data,
              r.created_at, r.submitted_at, r.completed_at,
              u.full_name AS requester_name,
              (SELECT name FROM approval_request_step s
                WHERE s.request_id = r.id AND s.step_order = r.current_step LIMIT 1) AS current_step_name
         FROM approval_request r
    LEFT JOIN app_user u ON u.id = r.requester_id
        WHERE r.form_id = $1
          AND r.created_at >= $2::date
          AND r.created_at < ($3::date + interval '1 day')
        ORDER BY r.created_at`,
      [id, from, to]
    )
    res.json({ form: forms[0], fields, rows })
  } catch (err) {
    console.error('exportRequests:', err)
    res.status(500).json({ error: 'Không thể xuất dữ liệu đơn.' })
  }
}

// ── Tạo loại đơn ──────────────────────────────────────────────────────────────
export async function createForm(req, res) {
  const { code, name, description, icon, sort_order } = req.body
  if (!code?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'Mã và tên loại đơn không được để trống.' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO approval_form (code, name, description, icon, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), description?.trim() || null,
       icon?.trim() || null, Number(sort_order) || 0, req.user.id]
    )
    invalidateApprovalForms()
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Mã loại đơn đã tồn tại.' })
    console.error('createForm:', err)
    res.status(500).json({ error: 'Không thể tạo loại đơn.' })
  }
}

// ── Cập nhật thông tin loại đơn ───────────────────────────────────────────────
export async function updateForm(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const { name, description, icon, is_active, sort_order } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Tên loại đơn không được để trống.' })
  try {
    const { rows } = await pool.query(
      `UPDATE approval_form SET
         name = $1, description = $2, icon = $3, is_active = $4, sort_order = $5, updated_at = now()
       WHERE id = $6 RETURNING *`,
      [name.trim(), description?.trim() || null, icon?.trim() || null,
       is_active !== false, Number(sort_order) || 0, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy loại đơn.' })
    invalidateApprovalForms()
    res.json(rows[0])
  } catch (err) {
    console.error('updateForm:', err)
    res.status(500).json({ error: 'Không thể cập nhật loại đơn.' })
  }
}

// ── Xóa loại đơn ──────────────────────────────────────────────────────────────
export async function deleteForm(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  try {
    const { rowCount } = await pool.query(`DELETE FROM approval_form WHERE id = $1`, [id])
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy loại đơn.' })
    invalidateApprovalForms()
    res.json({ success: true })
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Loại đơn đã có đơn sử dụng — không thể xóa. Hãy đặt "Ngừng dùng" thay vì xóa.',
      })
    }
    console.error('deleteForm:', err)
    res.status(500).json({ error: 'Không thể xóa loại đơn.' })
  }
}

// ── Lưu toàn bộ danh sách trường (thay thế) ───────────────────────────────────
export async function saveFields(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const fields = Array.isArray(req.body?.fields) ? req.body.fields : null
  if (!fields) return res.status(400).json({ error: 'Thiếu danh sách trường.' })

  for (const f of fields) {
    if (!f.field_key?.trim() || !f.label?.trim()) {
      return res.status(400).json({ error: 'Mỗi trường cần khóa và nhãn.' })
    }
    if (!FIELD_TYPES.has(f.field_type)) {
      return res.status(400).json({ error: `Kiểu trường không hợp lệ: ${f.field_type}` })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(`SELECT 1 FROM approval_form WHERE id = $1`, [id])
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại đơn.' }) }

    await client.query(`DELETE FROM approval_form_field WHERE form_id = $1`, [id])
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      await client.query(
        `INSERT INTO approval_form_field
           (form_id, field_key, label, field_type, options, is_required, sort_order, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, f.field_key.trim(), f.label.trim(), f.field_type,
         f.options ? JSON.stringify(f.options) : null,
         !!f.is_required, Number(f.sort_order) || i,
         f.config ? JSON.stringify(f.config) : null]
      )
    }
    await client.query(`UPDATE approval_form SET updated_at = now() WHERE id = $1`, [id])
    await client.query('COMMIT')
    invalidateApprovalForms() // đổi field_count hiển thị ở danh sách loại đơn
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Khóa trường bị trùng trong cùng loại đơn.' })
    console.error('saveFields:', err)
    res.status(500).json({ error: 'Không thể lưu các trường.' })
  } finally {
    client.release()
  }
}

// ── Lưu toàn bộ chuỗi bước duyệt + người duyệt (thay thế) ─────────────────────
export async function saveSteps(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const steps = Array.isArray(req.body?.steps) ? req.body.steps : null
  if (!steps) return res.status(400).json({ error: 'Thiếu danh sách bước duyệt.' })

  for (const s of steps) {
    if (!s.name?.trim()) return res.status(400).json({ error: 'Mỗi bước cần có tên.' })
    if (s.rule && !STEP_RULES.has(s.rule)) return res.status(400).json({ error: `Quy tắc bước không hợp lệ: ${s.rule}` })
    const source = s.approver_source || 'fixed'
    if (!APPROVER_SOURCES.has(source)) return res.status(400).json({ error: `Nguồn người duyệt không hợp lệ: ${source}` })
    // Điều kiện áp dụng bước theo chức danh người gửi.
    const condMode = s.condition_mode || 'always'
    if (!CONDITION_MODES.has(condMode)) return res.status(400).json({ error: `Điều kiện bước không hợp lệ: ${condMode}` })
    if (condMode !== 'always') {
      const pos = Array.isArray(s.condition_positions) ? s.condition_positions.map(Number).filter(Number.isInteger) : []
      if (!pos.length) return res.status(400).json({ error: `Bước "${s.name}" có điều kiện theo chức danh nhưng chưa chọn chức danh nào.` })
    }
    // Chỉ nguồn 'fixed' mới cần admin chọn sẵn người duyệt.
    if (source === 'fixed') {
      const approvers = Array.isArray(s.approvers) ? s.approvers : []
      if (!approvers.length) return res.status(400).json({ error: `Bước "${s.name}" (cố định) cần ít nhất một người duyệt.` })
      for (const a of approvers) {
        if (a.approver_type && !APPROVER_TYPES.has(a.approver_type)) {
          return res.status(400).json({ error: `Loại người duyệt không hợp lệ: ${a.approver_type}` })
        }
        if (!String(a.approver_ref ?? '').trim()) {
          return res.status(400).json({ error: `Bước "${s.name}" có người duyệt chưa chọn.` })
        }
      }
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(`SELECT 1 FROM approval_form WHERE id = $1`, [id])
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại đơn.' }) }

    // Xóa bước cũ (cascade tự xóa approver theo FK ON DELETE CASCADE).
    await client.query(`DELETE FROM approval_form_step WHERE form_id = $1`, [id])
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const source = s.approver_source || 'fixed'
      const condMode = s.condition_mode || 'always'
      const condPositions = condMode === 'always'
        ? []
        : [...new Set((Array.isArray(s.condition_positions) ? s.condition_positions : []).map(Number).filter(Number.isInteger))]
      const { rows: stepRows } = await client.query(
        `INSERT INTO approval_form_step (form_id, step_order, name, rule, approver_source, condition_mode, condition_positions)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [id, i + 1, s.name.trim(), s.rule || 'any', source, condMode, JSON.stringify(condPositions)]
      )
      const stepId = stepRows[0].id
      // Chỉ lưu danh sách người duyệt cố định cho nguồn 'fixed'.
      if (source === 'fixed') {
        for (const a of (s.approvers || [])) {
          await client.query(
            `INSERT INTO approval_form_step_approver (step_id, approver_type, approver_ref)
             VALUES ($1, $2, $3)`,
            [stepId, a.approver_type || 'user', String(a.approver_ref).trim()]
          )
        }
      }
    }
    await client.query(`UPDATE approval_form SET updated_at = now() WHERE id = $1`, [id])
    await client.query('COMMIT')
    invalidateApprovalForms() // đổi step_count hiển thị ở danh sách loại đơn
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('saveSteps:', err)
    res.status(500).json({ error: 'Không thể lưu chuỗi bước duyệt.' })
  } finally {
    client.release()
  }
}

// ── Lưu danh sách người theo dõi của loại đơn (thay thế) ──────────────────────
// Nhận { user_ids: [<id>, ...] }. Admin định sẵn; người gửi không sửa được.
export async function saveFollowers(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const raw = Array.isArray(req.body?.user_ids) ? req.body.user_ids : null
  if (!raw) return res.status(400).json({ error: 'Thiếu danh sách người theo dõi.' })
  // Chuẩn hóa → mảng số nguyên duy nhất.
  const userIds = [...new Set(raw.map(x => parseInt(x, 10)).filter(Number.isInteger))]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(`SELECT 1 FROM approval_form WHERE id = $1`, [id])
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại đơn.' }) }

    await client.query(`DELETE FROM approval_form_follower WHERE form_id = $1`, [id])
    for (const uid of userIds) {
      await client.query(
        `INSERT INTO approval_form_follower (form_id, user_id) VALUES ($1, $2)
         ON CONFLICT (form_id, user_id) DO NOTHING`,
        [id, uid]
      )
    }
    await client.query(`UPDATE approval_form SET updated_at = now() WHERE id = $1`, [id])
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23503') return res.status(400).json({ error: 'Có người theo dõi không tồn tại.' })
    console.error('saveFollowers:', err)
    res.status(500).json({ error: 'Không thể lưu người theo dõi.' })
  } finally {
    client.release()
  }
}

// ── Lưu danh sách PHÒNG BAN được dùng loại đơn (thay thế) ─────────────────────
// Nhận { department_ids: [<id>, ...] }. Rỗng = áp dụng cho mọi phòng ban.
export async function saveDepartments(req, res) {
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })
  const raw = Array.isArray(req.body?.department_ids) ? req.body.department_ids : null
  if (!raw) return res.status(400).json({ error: 'Thiếu danh sách phòng ban.' })
  const deptIds = [...new Set(raw.map(x => parseInt(x, 10)).filter(Number.isInteger))]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rowCount } = await client.query(`SELECT 1 FROM approval_form WHERE id = $1`, [id])
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại đơn.' }) }

    await client.query(`DELETE FROM approval_form_department WHERE form_id = $1`, [id])
    for (const did of deptIds) {
      await client.query(
        `INSERT INTO approval_form_department (form_id, department_id) VALUES ($1, $2)
         ON CONFLICT (form_id, department_id) DO NOTHING`,
        [id, did]
      )
    }
    await client.query(`UPDATE approval_form SET updated_at = now() WHERE id = $1`, [id])
    await client.query('COMMIT')
    invalidateApprovalForms() // đổi phạm vi phòng ban → danh sách loại đơn user được tạo đổi
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23503') return res.status(400).json({ error: 'Có phòng ban không tồn tại.' })
    console.error('saveDepartments:', err)
    res.status(500).json({ error: 'Không thể lưu phòng ban áp dụng.' })
  } finally {
    client.release()
  }
}
