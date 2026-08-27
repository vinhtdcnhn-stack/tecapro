import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel, pmUserIds, userFullName } from '../services/notify.js'
import { activateReadyTasks } from '../services/taskAutoStart.js'
import { cascadeCompletion, notifyCascade } from '../services/taskCascade.js'
import { postTaskEntry } from '../services/taskEntryPost.js'
import { BASE_SELECT } from './taskSelect.js'
import { invalidateDashboardsForContractTask } from '../services/cacheKeys.js'

// ─────────────────────────────────────────────────────────────────────────────
// TRẠNG THÁI + XÁC NHẬN HOÀN THÀNH của công việc hợp đồng.
//
// Luồng: người được giao làm xong → tự chọn "Hoàn thành" → việc mang trạng thái
// 'Hoàn thành' nhưng gắn cờ completion_pending (hiện ⏳ "chờ xác nhận"). Người GIAO việc
// (hoặc PM/admin) bấm:
//   • Xác nhận  → gỡ cờ, chốt hoàn thành (ghi người duyệt + thời điểm duyệt);
//   • Chưa đạt  → BẮT BUỘC nhập lý do → việc về 'Đang thực hiện', lý do vào dòng thời gian.
//
// Người có quyền xác nhận tự đặt 'Hoàn thành' thì chốt luôn, không phải chờ ai.
// Việc CÓ VIỆC CON không đổi trạng thái tay được (tự tính theo con — taskCascade.js).
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = new Set(['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy'])
const DONE = 'Hoàn thành'

// Chạy 1 câu UPDATE trong transaction rồi lan trạng thái lên việc cha (cascade), trả về
// danh sách node cha đã tự đổi để báo Telegram SAU khi commit.
async function updateThenCascade(id, sql, params) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql, params)
    const cascaded = await cascadeCompletion(client, id)
    await client.query('COMMIT')
    return cascaded
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

// Trả bản ghi đầy đủ (đúng hình dạng client đang dùng) sau khi cập nhật.
async function respondTask(res, id) {
  const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
  if (!full.rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
  return res.json(full.rows[0])
}

// Người cần biết kết quả: người giao việc + PM của HĐ (trừ người vừa thao tác).
async function confirmerIds(task, exceptUserId) {
  const ids = [Number(task.created_by) || null, ...(await pmUserIds(String(task.contract_out_id)))]
  return [...new Set(ids.map(Number))].filter(uid => uid && uid !== Number(exceptUserId))
}

// Người THỰC HIỆN cần biết kết quả duyệt: người đang được giao + người đã bấm báo hoàn
// thành (có thể khác nhau nếu việc vừa được chuyển cho người khác), trừ người vừa thao tác.
function doerIds(task, exceptUserId) {
  return [...new Set([Number(task.assigned_to), Number(task.completion_requested_by)])]
    .filter(uid => uid && uid !== Number(exceptUserId))
}

// ── PATCH /tasks/:id/status  { status } ──────────────────────────────────────
// Guard canChangeTaskStatus đã gắn req.taskRoles.
export async function changeTaskStatus(req, res) {
  const id = parseInt(req.params.id)
  const status = String(req.body?.status ?? '').trim()
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })

  const { task, canConfirm } = req.taskRoles
  if (task.child_count > 0) {
    return res.status(400).json({ error: 'Việc có việc con — trạng thái tự tính theo các việc con.' })
  }
  // Người chỉ được giao việc không tự "Hủy" việc của mình (đó là quyết định của quản lý).
  if (status === 'Hủy' && !canConfirm) {
    return res.status(403).json({ error: 'Chỉ người giao việc, PM hoặc admin mới được hủy công việc.' })
  }

  // Đặt "Hoàn thành": người có quyền xác nhận → chốt luôn; người được giao → chờ xác nhận.
  const pending = status === DONE && !canConfirm
  try {
    const cascaded = await updateThenCascade(id,
      `UPDATE contract_task SET
         status       = $1,
         completed_at = CASE WHEN $1::varchar = 'Hoàn thành' THEN COALESCE(completed_at, now()) ELSE NULL END,
         completion_pending      = $2,
         completion_requested_by = CASE WHEN $2 THEN $3::int ELSE NULL END,
         completion_requested_at = CASE WHEN $2 THEN now() ELSE NULL END,
         completion_approved_by  = CASE WHEN $1::varchar = 'Hoàn thành' AND NOT $2 THEN $3::int ELSE NULL END,
         completion_approved_at  = CASE WHEN $1::varchar = 'Hoàn thành' AND NOT $2 THEN now() ELSE NULL END,
         updated_at   = now()
       WHERE id = $4`,
      [status, pending, req.user.id, id])
    await respondTask(res, id)
    // Trạng thái/cờ chờ duyệt đổi → dòng việc trên các dashboard theo dõi đổi theo
    // (việc chờ duyệt vẫn nằm lại bảng kèm dấu ⏳) → làm mới cache dashboard liên quan.
    invalidateDashboardsForContractTask(id)

    if (cascaded.length) notifyCascade(cascaded)
    // Vừa xong 1 bước → mở khóa các việc phụ thuộc đã đủ điều kiện.
    if (status === DONE && task.status !== DONE) {
      try { await activateReadyTasks() } catch (e) { console.error('activateReadyTasks:', e) }
    }

    // Thông báo: chờ xác nhận → 🔔 cho người giao/PM; đổi trạng thái khác → tin thường.
    const label = await contractLabel(task.contract_out_id)
    if (pending) {
      const to = await confirmerIds(task, req.user.id)
      if (to.length) {
        const who = await userFullName(req.user.id)
        notifyAction(to, `${who} báo ĐÃ HOÀN THÀNH công việc:\n"${task.title}" (HĐ ${label})\n`
          + 'Vào tab Công việc triển khai để XÁC NHẬN hoàn thành, hoặc trả lại kèm lý do nếu chưa đạt.')
      }
    } else if (status !== task.status) {
      const to = [...new Set([Number(task.created_by), Number(task.assigned_to)])]
        .filter(uid => uid && uid !== Number(req.user.id))
      if (to.length) {
        notifyInfo(to, `Công việc "${task.title}" (HĐ ${label}) đã chuyển sang trạng thái: ${status}`)
      }
    }
  } catch (err) {
    console.error('changeTaskStatus:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể đổi trạng thái công việc.' })
  }
}

// ── POST /tasks/:id/completion/confirm ───────────────────────────────────────
export async function confirmCompletion(req, res) {
  const id = parseInt(req.params.id)
  const { task } = req.taskRoles
  if (!task.completion_pending) {
    return res.status(400).json({ error: 'Công việc này không ở trạng thái chờ xác nhận.' })
  }
  try {
    const cascaded = await updateThenCascade(id,
      `UPDATE contract_task SET
         status = 'Hoàn thành',
         completed_at = COALESCE(completed_at, now()),
         completion_pending = false,
         completion_approved_by = $1,
         completion_approved_at = now(),
         updated_at = now()
       WHERE id = $2`,
      [req.user.id, id])
    await respondTask(res, id)
    // Chốt/trả lại → dòng việc rời hoặc quay lại bảng theo dõi → làm mới cache dashboard.
    invalidateDashboardsForContractTask(id)

    if (cascaded.length) notifyCascade(cascaded)
    try { await activateReadyTasks() } catch (e) { console.error('activateReadyTasks:', e) }

    // Báo NGƯỜI THỰC HIỆN: kết quả đã được duyệt (tin nắm bắt, không phải việc cần làm).
    const doers = doerIds(task, req.user.id)
    if (doers.length) {
      const label = await contractLabel(task.contract_out_id)
      const who = await userFullName(req.user.id)
      notifyInfo(doers, `✅ ${who} đã XÁC NHẬN HOÀN THÀNH công việc của bạn:\n"${task.title}" (HĐ ${label})`)
    }

    // Ghi 1 mục "Quyết định" vào dòng thời gian để lưu vết ai đã duyệt (kèm báo Telegram
    // cho những người liên quan khác — người thực hiện đã nhận tin riêng ở trên).
    postTaskEntry({
      taskId: id, type: 'decision', authorId: req.user.id,
      content: '✅ Đã xác nhận HOÀN THÀNH công việc.',
      contractId: task.contract_out_id, createdBy: task.created_by, assignedTo: task.assigned_to,
      skipUserIds: doers,
    }).catch(e => console.error('confirmCompletion entry:', e))
  } catch (err) {
    console.error('confirmCompletion:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể xác nhận hoàn thành.' })
  }
}

// ── POST /tasks/:id/completion/reject  { reason } ────────────────────────────
export async function rejectCompletion(req, res) {
  const id = parseInt(req.params.id)
  const reason = String(req.body?.reason ?? '').trim()
  if (!reason) return res.status(400).json({ error: 'Vui lòng nhập lý do chưa hoàn thành.' })

  const { task } = req.taskRoles
  if (!task.completion_pending) {
    return res.status(400).json({ error: 'Công việc này không ở trạng thái chờ xác nhận.' })
  }
  try {
    const count = Number(task.completion_reject_count || 0) + 1
    const cascaded = await updateThenCascade(id,
      `UPDATE contract_task SET
         status = 'Đang thực hiện',
         completed_at = NULL,
         completion_pending = false,
         completion_approved_by = NULL,
         completion_approved_at = NULL,
         completion_reject_reason = $1,
         completion_reject_count  = $2,
         updated_at = now()
       WHERE id = $3`,
      [reason, count, id])
    await respondTask(res, id)
    // Chốt/trả lại → dòng việc rời hoặc quay lại bảng theo dõi → làm mới cache dashboard.
    invalidateDashboardsForContractTask(id)

    if (cascaded.length) notifyCascade(cascaded)

    // Báo NGƯỜI THỰC HIỆN: việc bị trả lại, cần làm tiếp → notifyAction (🔔 + đậm) kèm lý do.
    const doers = doerIds(task, req.user.id)
    if (doers.length) {
      const label = await contractLabel(task.contract_out_id)
      const who = await userFullName(req.user.id)
      notifyAction(doers, `❌ ${who} đánh giá CHƯA ĐẠT công việc của bạn:\n"${task.title}" (HĐ ${label})\n`
        + `Lý do: ${reason}\nViệc đã quay lại "Đang thực hiện" — vui lòng xử lý rồi báo hoàn thành lại.`)
    }

    // Lý do vào dòng thời gian (mục "Quyết định") để lưu vết; người thực hiện đã nhận tin
    // riêng ở trên nên không gửi trùng cho họ.
    postTaskEntry({
      taskId: id, type: 'decision', authorId: req.user.id,
      content: `❌ CHƯA ĐẠT — yêu cầu làm lại (lần ${count}).\nLý do: ${reason}`,
      contractId: task.contract_out_id, createdBy: task.created_by, assignedTo: task.assigned_to,
      skipUserIds: doers,
    }).catch(e => console.error('rejectCompletion entry:', e))
  } catch (err) {
    console.error('rejectCompletion:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể trả lại công việc.' })
  }
}
