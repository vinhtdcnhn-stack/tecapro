import { pool } from '../db.js'
import { TECH_DEPT_IDS } from '../auth/departmentIds.js'
import { notifyAction, contractLabel, fmtDate } from '../services/notify.js'
import { invalidateUserDashboards, invalidateContractMembers, invalidateContractList } from '../services/cacheKeys.js'
import { BASE_SELECT } from './taskSelect.js'
import { MEMBER_ROLE_RANK } from './contractMemberController.js'

// ──────────────────────────────────────────────────────────────────────────────
// "Gửi lệnh nhập serial" — từ tab NHẬN HÀNG của hợp đồng nhập, người tạo HĐ nhập
// giao cho một người KỸ THUẬT việc nhập serial cho các đợt đã nhận.
//
// Lệnh này TẠO MỘT CÔNG VIỆC của hợp đồng bán mẹ (contract_task) để nó chảy vào
// đúng dòng công việc / dòng thời gian trao đổi sẵn có — không dựng luồng riêng.
// Người nhận có Telegram sẽ nhận thông báo "cần xử lý" (🔔).
//
// Mô tả việc CHÈN SẴN đường dẫn sâu tới đúng tab "Quản lý Serial" của hợp đồng nhập
// (Linkify ở khung chi tiết việc biến nó thành link bấm được) + chỉ đường bằng lời,
// để người nhận không phải mò xem phải điền serial ở đâu.
//
// Gửi lệnh CŨNG LÀ TRAO QUYỀN: ghi serial đòi người đó phải nằm trong danh sách
// "Kỹ thuật" của HĐ bán cha (guard ownerOrTechVia), nên ở đây tự thêm luôn — không
// thì người nhận mở ra sẽ bị chặn, đúng bài toán mà autoAddTechnicalMember giải cho
// luồng "Chuyển việc".
// ──────────────────────────────────────────────────────────────────────────────

const TECHNICAL_ROLE = 'Technical'

// Đường dẫn sâu tới tab "Quản lý Serial" của một HĐ nhập, khớp contractPath() ở client.
const serialTabPath = (contractOutId, contractInId) =>
  `/qlda/${contractOutId}?tab=purchase-contract-info&inId=${contractInId}&inTab=serials`

// Danh sách người KỸ THUẬT có thể nhận lệnh: nhân sự đang làm việc thuộc Ban Dự án &
// chuyển giao công nghệ / Ban Kỹ thuật (phòng chính hoặc kiêm nhiệm).
export async function getSerialOrderCandidates(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, d.name AS department_name
         FROM app_user u
         LEFT JOIN department d ON d.id = u.department_id
        WHERE u.is_active IS NOT FALSE
          AND (u.department_id = ANY($1::int[])
               OR EXISTS (SELECT 1 FROM app_user_department ud
                           WHERE ud.user_id = u.id AND ud.department_id = ANY($1::int[])))
        ORDER BY u.full_name`,
      [TECH_DEPT_IDS],
    )
    res.json(rows)
  } catch (err) {
    console.error('getSerialOrderCandidates:', err)
    res.status(500).json({ error: 'Không thể tải danh sách nhân sự kỹ thuật.' })
  }
}

// POST /contract-ins/:contractInId/serial-order  { assigned_to, due_date, note }
export async function createSerialOrder(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  const assignedTo = parseInt(req.body?.assigned_to)
  const dueDate = req.body?.due_date || null
  const note = req.body?.note?.trim() || ''

  if (!Number.isFinite(assignedTo)) {
    return res.status(400).json({ error: 'Chưa chọn người nhận lệnh.' })
  }

  try {
    const { rows: ci } = await pool.query(
      `SELECT ci.id, ci.contract_out_id, ci.contract_no, s.name AS supplier_name
         FROM contract_in ci
         LEFT JOIN supplier s ON s.id = ci.supplier_id
        WHERE ci.id = $1`,
      [contractInId],
    )
    if (!ci.length) return res.status(404).json({ error: 'Không tìm thấy hợp đồng nhập.' })
    const contractOutId = ci[0].contract_out_id

    const { rows: assignee } = await pool.query(
      'SELECT id, full_name, department_id FROM app_user WHERE id = $1 AND is_active IS NOT FALSE',
      [assignedTo],
    )
    if (!assignee.length) return res.status(400).json({ error: 'Người nhận lệnh không hợp lệ.' })

    // Tóm tắt các đợt nhận còn thiếu serial → đưa vào mô tả việc để người nhận biết làm gì.
    const { rows: batches } = await pool.query(
      `SELECT d.batch_name, d.receive_date,
              COUNT(di.id)::int                                   AS item_count,
              COALESCE(SUM(di.received_quantity), 0)::numeric     AS qty,
              COUNT(ds.id)::int                                   AS serial_count
         FROM contract_in_delivery d
         LEFT JOIN contract_in_delivery_item di ON di.delivery_id = d.id
         LEFT JOIN contract_in_delivery_serial ds ON ds.delivery_item_id = di.id
        WHERE d.contract_in_id = $1
        GROUP BY d.id
        ORDER BY d.receive_date DESC, d.id DESC`,
      [contractInId],
    )
    const batchLines = batches.map(b => {
      const name = b.batch_name || `Đợt ${fmtDate(b.receive_date)}`
      const qty = (Number(b.qty) || 0).toLocaleString('vi-VN')
      return `• ${name}: ${b.item_count} loại hàng, SL nhận ${qty} — đã có ${b.serial_count} serial`
    })

    const hdIn = ci[0].contract_no || `#${contractInId}`
    const title = `Nhập serial hàng hóa — HĐ nhập ${hdIn}`
    const description = [
      `Nhập serial cho hàng đã nhận theo hợp đồng nhập ${hdIn}` +
        (ci[0].supplier_name ? ` (NCC: ${ci[0].supplier_name})` : '') + '.',
      batchLines.length ? `\nCác đợt nhận hàng:\n${batchLines.join('\n')}` : '',
      note ? `\nGhi chú: ${note}` : '',
      `\nNhập serial ở đây: ${serialTabPath(contractOutId, contractInId)}`,
      '(bấm thẳng vào đường dẫn trên; hoặc mở hợp đồng bán → mục "Thông tin hợp đồng nhập"'
        + ` → chọn HĐ ${hdIn} → tab "Quản lý Serial")`,
    ].filter(Boolean).join('\n')

    const { rows: task } = await pool.query(
      `INSERT INTO contract_task
         (contract_out_id, title, description, department_id, assigned_to, created_by,
          priority, due_date, status, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Bình thường',$7,'Đang thực hiện',
               (SELECT COALESCE(MAX(sort_order),0)+1 FROM contract_task WHERE contract_out_id = $1),
               NOW(), NOW())
       RETURNING id`,
      [contractOutId, title, description, assignee[0].department_id || null,
       assignedTo, req.user.id, dueDate],
    )
    const taskId = task[0].id

    await pool.query(
      `INSERT INTO contract_task_assignment_log (task_id, from_user_id, to_user_id, action, actor_id, note)
       VALUES ($1, NULL, $2, 'assign', $3, $4)`,
      [taskId, assignedTo, req.user.id, 'Gửi lệnh nhập serial'],
    )

    // Trao quyền ghi serial: thêm người nhận vào danh sách Kỹ thuật của HĐ bán cha nếu
    // chưa có (uq_contract_member lo phần trùng). Không có bước này thì họ mở tab Quản lý
    // Serial ra là bị guard chặn.
    const addedTech = await pool.query(
      `INSERT INTO contract_out_member (contract_out_id, user_id, member_role, is_primary, role_rank)
       VALUES ($1, $2, $3, false, $4)
       ON CONFLICT ON CONSTRAINT uq_contract_member DO NOTHING`,
      [contractOutId, assignedTo, TECHNICAL_ROLE, MEMBER_ROLE_RANK[TECHNICAL_ROLE]],
    )
    const justAddedTech = addedTech.rowCount > 0

    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [taskId])
    res.status(201).json({ ...full[0], added_technical_member: justAddedTech })

    // Hậu kỳ (không chặn response). Danh sách việc không cache; chỉ dashboard người nhận.
    invalidateUserDashboards(assignedTo).catch(e => console.error('serialOrder invalidate:', e))
    if (justAddedTech) {
      // Vừa thành thành viên HĐ bán → danh sách thành viên + danh sách HĐ của họ đổi.
      invalidateContractMembers(contractOutId)
      invalidateContractList()
    }
    if (assignedTo !== req.user.id) {
      contractLabel(contractOutId).then(label => {
        const han = dueDate ? `\nHạn: ${fmtDate(dueDate)}` : ''
        const gc = note ? `\nGhi chú: ${note}` : ''
        const tech = justAddedTech
          ? `\nBạn vừa được thêm vào danh sách Kỹ thuật của hợp đồng này để nhập được serial.`
          : ''
        const noi = `\nNhập serial tại: HĐ nhập ${hdIn} → tab "Quản lý Serial"`
          + ' (mở việc trong phần mềm để bấm thẳng đường dẫn).'
        notifyAction([assignedTo], `Lệnh nhập serial: "${title}" — HĐ ${label}${han}${gc}${tech}${noi}`)
      }).catch(() => {})
    }
  } catch (err) {
    console.error('createSerialOrder:', err)
    res.status(500).json({ error: 'Không thể gửi lệnh nhập serial.' })
  }
}
