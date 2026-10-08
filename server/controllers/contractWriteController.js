import { pool, FROZEN_SQLSTATE } from '../db.js'
import { insertContractMembers, syncContractMembers, MEMBER_ROLE_VN } from './contractMemberController.js'
import { notifyAction, notifyInfo, contractLabel } from '../services/notify.js'
import {
  invalidateContractAll, invalidateContractList, invalidateContractMembers,
  invalidateUserDashboards, invalidateReports,
} from '../services/cacheKeys.js'
import {
  COMPLETED, canToggleCompletion, touchesCompletion, COMPLETION_DENIED_MSG,
} from '../auth/completionAuthority.js'

// Ghi HĐ bán: kiểm tra trùng số, tạo, sửa, và đổi trạng thái "Hoàn thành" (khóa HĐ).
// Tách từ contractController.js (phần đọc) để giữ mỗi file dưới 500 dòng.

const FROZEN_MSG = 'Hợp đồng đã Hoàn thành — không thể sửa. Cần Trưởng/Phó Ban Triển khai Dự án chuyển về "Đang thực hiện" trước.'

// Tạo/sửa HĐ ảnh hưởng: danh sách HĐ (mọi user), dashboard thành viên, và báo cáo có dùng
// metadata HĐ (công nợ theo HĐ/KH + khoảng ngày + trạng thái; bảo hành & việc quá hạn hiển
// thị số HĐ/tên KH). Gọi sau khi ghi thành công.
function invalidateContractMeta(contractId) {
  invalidateContractList()
  invalidateContractMembers(contractId)
  invalidateReports('debt')
  invalidateReports('warranty')
  invalidateReports('task')
}

// Gửi thông báo Telegram cho các thành viên vừa được thêm vào hợp đồng.
// PM → việc cần xử lý (🔔 in đậm); vai trò khác → thông tin. Bỏ qua người tự thêm mình.
async function notifyNewMembers(contractId, members, actorId) {
  if (!members?.length) return
  const label = await contractLabel(contractId)
  for (const m of members) {
    if (!m.user_id || m.user_id === actorId) continue
    const roleVN = MEMBER_ROLE_VN[m.member_role] || m.member_role
    if (m.member_role === 'PM') {
      notifyAction([m.user_id], `Bạn được phân công làm ${m.is_primary ? 'PM chủ trì' : 'PM'} hợp đồng ${label}`)
    } else {
      notifyInfo([m.user_id], `Bạn được thêm vào hợp đồng ${label} với vai trò: ${roleVN}`)
    }
  }
}

// Kiểm tra trùng số hợp đồng
export async function checkContractNoDuplicate(req, res) {
  const contractNo = String(req.body?.contract_no ?? '').trim().toUpperCase()

  if (!contractNo) {
    res.status(400).json({
      exists: false,
      error: 'Số hợp đồng không được để trống.'
    })
    return
  }

  try {
    const { rows } = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1',
      [contractNo]
    )

    res.json({
      exists: rows.length > 0
    })
  } catch (err) {
    console.error('Error checking contract_no duplicate:', err)
    res.status(500).json({
      exists: false,
      error: 'Có lỗi xảy ra khi kiểm tra.'
    })
  }
}

// Tạo hợp đồng mới
export async function createContract(req, res) {
  const {
    contract_no,
    contract_date,
    project_name,
    customer_id,
    tender_name,
    amount_before_vat,
    amount_after_vat,
    currency_code,
    exchange_rate,
    terms,
    status,
    is_joint_venture,
    pm_primary_id,
    pm_team,
    sale_team,
    presale_team,
    technical_team,
    import_export_team,
    accounting_team,
    followers
  } = req.body

  // Validation các trường bắt buộc
  if (!contract_no || !contract_date || !project_name || !customer_id) {
    res.status(400).json({
      error: 'Các trường Số hợp đồng, Ngày ký, Tên dự án và Chủ đầu tư là bắt buộc.'
    })
    return
  }

  const finalStatus = status || 'Pending'
  if (finalStatus === COMPLETED && !(await canToggleCompletion(req.user))) {
    res.status(403).json({ error: COMPLETION_DENIED_MSG })
    return
  }

  try {
    // Kiểm tra trùng số hợp đồng lần nữa ở backend
    const checkResult = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1',
      [String(contract_no).trim().toUpperCase()]
    )

    if (checkResult.rows.length > 0) {
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    // Bắt đầu transaction
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Insert hợp đồng
      const insertContractSql = `
        INSERT INTO contract_out (
          contract_no,
          contract_date,
          project_name,
          customer_id,
          tender_name,
          amount_before_vat,
          amount_after_vat,
          currency_code,
          exchange_rate,
          payment_term,
          status,
          is_joint_venture,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id
      `

      const contractResult = await client.query(insertContractSql, [
        String(contract_no).trim().toUpperCase(),
        contract_date,
        project_name.trim(),
        parseInt(customer_id),
        tender_name?.trim() || null,
        parseFloat(amount_before_vat) || 0,
        parseFloat(amount_after_vat) || 0,
        currency_code || 'VND',
        exchange_rate ? parseFloat(exchange_rate) : null,
        terms?.trim() || null,
        // Tạo HĐ "Hoàn thành": chèn tạm "Đang thực hiện" để còn thêm được thành viên
        // (HĐ Hoàn thành bị khóa ghi — migration 108), rồi mới chốt trạng thái ở dưới.
        finalStatus === COMPLETED ? 'Active' : finalStatus,
        is_joint_venture === true
      ])

      const contractId = contractResult.rows[0].id

      const inserted = await insertContractMembers(client, contractId, { pm_primary_id, pm_team, sale_team, presale_team, technical_team, import_export_team, accounting_team, followers })
      if (finalStatus === COMPLETED) {
        await client.query('UPDATE contract_out SET status = $1 WHERE id = $2', [COMPLETED, contractId])
      }

      await client.query('COMMIT')

      invalidateContractMeta(contractId)

      res.json({
        success: true,
        id: contractId,
        contract_no: String(contract_no).trim().toUpperCase()
      })

      // Báo các thành viên vừa được thêm (fire-and-forget, sau commit).
      notifyNewMembers(contractId, inserted, req.user?.id)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Error creating contract:', err)

    if (err.code === '23505') {
      // Unique constraint violation
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    res.status(500).json({
      error: 'Có lỗi xảy ra khi tạo hợp đồng.'
    })
  }
}

// Cập nhật hợp đồng
export async function updateContract(req, res) {
  const contractId = req.params.id
  const {
    contract_no,
    contract_date,
    project_name,
    customer_id,
    tender_name,
    currency_code,
    exchange_rate,
    terms,
    status,
    is_joint_venture,
    pm_primary_id,
    pm_team,
    sale_team,
    presale_team,
    technical_team,
    import_export_team,
    accounting_team,
    followers
  } = req.body

  // Validation các trường bắt buộc
  if (!contract_no || !contract_date || !project_name || !customer_id) {
    res.status(400).json({
      error: 'Các trường Số hợp đồng, Ngày ký, Tên dự án và Chủ đầu tư là bắt buộc.'
    })
    return
  }

  const newStatus = status || 'Pending'

  try {
    const cur = await pool.query('SELECT status FROM contract_out WHERE id = $1', [parseInt(contractId)])
    if (!cur.rows.length) {
      res.status(404).json({ error: 'Không tìm thấy hợp đồng' })
      return
    }
    const oldStatus = cur.rows[0].status
    // HĐ đang Hoàn thành mà vẫn giữ Hoàn thành → bị khóa, báo sớm (trigger cũng sẽ chặn).
    if (oldStatus === COMPLETED && newStatus === COMPLETED) {
      res.status(423).json({ error: FROZEN_MSG, frozen: true })
      return
    }
    // Chuyển sang/khỏi "Hoàn thành" chỉ Trưởng/Phó Ban Triển khai Dự án + admin.
    if (touchesCompletion(oldStatus, newStatus) && !(await canToggleCompletion(req.user))) {
      res.status(403).json({ error: COMPLETION_DENIED_MSG })
      return
    }

    // Kiểm tra trùng số hợp đồng (trừ chính nó)
    const checkResult = await pool.query(
      'SELECT id FROM contract_out WHERE UPPER(TRIM(contract_no)) = $1 AND id != $2',
      [String(contract_no).trim().toUpperCase(), parseInt(contractId)]
    )

    if (checkResult.rows.length > 0) {
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    // Bắt đầu transaction
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Thứ tự quan trọng vì HĐ "Hoàn thành" bị khóa ghi (migration 108):
      //   • MỞ LẠI (Hoàn thành → khác): đổi trạng thái TRƯỚC để mở khóa, rồi mới sửa thành viên.
      //   • CHỐT (→ Hoàn thành): sửa thành viên TRƯỚC (lúc còn mở), UPDATE chính ở cuối mới khóa.
      if (oldStatus === COMPLETED) {
        await client.query('UPDATE contract_out SET status = $1 WHERE id = $2', [newStatus, parseInt(contractId)])
      }

      // Ghi nhớ thành viên cũ để (1) làm mới dashboard người bị gỡ, (2) không báo lại
      // người vốn đã là thành viên khi họ được thêm vào một vai trò khác.
      const before = await client.query(
        'SELECT user_id FROM contract_out_member WHERE contract_out_id = $1',
        [parseInt(contractId)],
      )
      const oldIds = new Set(before.rows.map(r => Number(r.user_id)))

      // Đồng bộ theo diff (chỉ thêm/bớt phần thay đổi) để nhật ký không phình xoá-chèn cả danh sách.
      const inserted = await syncContractMembers(client, parseInt(contractId), { pm_primary_id, pm_team, sale_team, presale_team, technical_team, import_export_team, accounting_team, followers })

      // Update hợp đồng (amount_before_vat/after_vat lấy từ bảng giá BOQ, không sửa ở đây)
      const updateContractSql = `
        UPDATE contract_out SET
          contract_no = $1,
          contract_date = $2,
          project_name = $3,
          customer_id = $4,
          tender_name = $5,
          currency_code = $6,
          exchange_rate = $7,
          payment_term = $8,
          status = $9,
          is_joint_venture = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING id
      `

      await client.query(updateContractSql, [
        String(contract_no).trim().toUpperCase(),
        contract_date,
        project_name.trim(),
        parseInt(customer_id),
        tender_name?.trim() || null,
        currency_code || 'VND',
        exchange_rate ? parseFloat(exchange_rate) : null,
        terms?.trim() || null,
        newStatus,
        is_joint_venture === true,
        parseInt(contractId)
      ])

      await client.query('COMMIT')

      // Đổi thông tin gốc (currency/exchange/customer/date/status) ảnh hưởng nhiều tab → xóa cả.
      invalidateContractAll(parseInt(contractId))
      invalidateContractMeta(parseInt(contractId))
      // Thành viên BỊ GỠ cũng cần làm mới dashboard (không còn HĐ này).
      for (const uid of oldIds) invalidateUserDashboards(uid)

      res.json({
        success: true,
        id: parseInt(contractId),
        contract_no: String(contract_no).trim().toUpperCase()
      })

      // Chỉ báo những thành viên chưa từng có trong hợp đồng (fire-and-forget, sau commit).
      notifyNewMembers(parseInt(contractId), (inserted || []).filter(m => !oldIds.has(m.user_id)), req.user?.id)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Error updating contract:', err)
    if (err.code === FROZEN_SQLSTATE) {
      res.status(423).json({ error: err.message, frozen: true })
      return
    }

    if (err.code === '23505') {
      res.status(400).json({
        error: 'Số hợp đồng đã tồn tại trong hệ thống.'
      })
      return
    }

    res.status(500).json({
      error: 'Có lỗi xảy ra khi cập nhật hợp đồng.'
    })
  }
}

// ── PATCH /contracts/:id/status ─ chốt "Hoàn thành" / mở lại "Đang thực hiện" ──────────
// Chỉ Trưởng/Phó Ban Triển khai Dự án + admin (canToggleCompletion) — KHÔNG cần quyền sửa
// thông tin HĐ (co.info.manage), vì người chốt thường không phải PM. Khi đã Hoàn thành, mọi
// thành phần của HĐ (trừ bảo hành) bị khóa ghi bởi trigger (migration 108).
export async function setContractStatus(req, res) {
  const contractId = parseInt(req.params.id)
  const target = req.body?.status
  if (target !== COMPLETED && target !== 'Active') {
    res.status(400).json({ error: 'Trạng thái chỉ được là "Hoàn thành" hoặc "Đang thực hiện".' })
    return
  }
  try {
    if (!(await canToggleCompletion(req.user))) {
      res.status(403).json({ error: COMPLETION_DENIED_MSG })
      return
    }
    const { rows } = await pool.query('SELECT status FROM contract_out WHERE id = $1', [contractId])
    if (!rows.length) {
      res.status(404).json({ error: 'Không tìm thấy hợp đồng' })
      return
    }
    const oldStatus = rows[0].status
    if (target === 'Active' && oldStatus !== COMPLETED) {
      res.status(400).json({ error: 'Hợp đồng chưa ở trạng thái "Hoàn thành".' })
      return
    }
    if (oldStatus === target) {
      res.json({ success: true, status: target })
      return
    }
    await pool.query('UPDATE contract_out SET status = $1, updated_at = NOW() WHERE id = $2', [target, contractId])

    invalidateContractAll(contractId)
    invalidateContractMeta(contractId)
    res.json({ success: true, status: target })

    // Báo PM của HĐ (fire-and-forget): biết HĐ đã bị khóa / được mở lại.
    notifyCompletionChange(contractId, target, req.user?.id)
  } catch (err) {
    console.error('setContractStatus:', err)
    res.status(500).json({ error: 'Không đổi được trạng thái hợp đồng.' })
  }
}

async function notifyCompletionChange(contractId, target, actorId) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT user_id FROM contract_out_member WHERE contract_out_id = $1 AND member_role = 'PM'`,
      [contractId],
    )
    const ids = rows.map(r => Number(r.user_id)).filter(id => id && id !== Number(actorId))
    if (!ids.length) return
    const label = await contractLabel(contractId)
    notifyInfo(ids, target === COMPLETED
      ? `Hợp đồng ${label} đã chuyển sang HOÀN THÀNH — mọi nội dung (trừ bảo hành) đã bị khóa.`
      : `Hợp đồng ${label} đã được mở lại "Đang thực hiện" — có thể chỉnh sửa trở lại.`)
  } catch (err) {
    console.error('notifyCompletionChange:', err)
  }
}
