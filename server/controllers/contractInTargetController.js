import { pool } from '../db.js'
import { invalidateContractIns } from './contractInController.js'
import { canManageContractInTargets } from '../middleware/contractAccess.js'
import { notifyInfo, pmUserIds, userFullName } from '../services/notify.js'

// Quản lý tập HĐ bán mà 1 HĐ nhập "nhập cho" (contract_in_target). Tối thiểu 1 (HĐ bán home
// nơi tạo HĐ nhập — luôn có mặt, không xóa được). Thêm/bớt để mở rộng danh sách target ở
// cột "Nhập cho" (bảng giá mua) và để HĐ nhập hiện trong danh sách HĐ nhập của HĐ bán được link.
//
// Quyền GHI (add/remove) = người tạo HĐ nhập, PM của HĐ bán GỐC, hoặc admin — xem
// canManageContractInTargets. Người có quyền gắn tới HĐ bán BẤT KỲ (không cần là thành viên
// HĐ bán đó), vì HĐ nhập thường phục vụ dự án của PM khác; bù lại PM của HĐ bán bị gắn/gỡ
// luôn được báo Telegram.

// GET /contract-ins/:contractInId/targets
// Trả { items, can_manage }. Mỗi item kèm cờ is_home (không xóa được) và has_links (đã có
// hàng gắn vào Theo dõi nhập hàng của HĐ bán đó → cũng không xóa được).
export async function getTargets(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  try {
    const canManage = await canManageContractInTargets(req.user, contractInId)
    const { rows } = await pool.query(
      `SELECT t.contract_out_id, co.contract_no, co.project_name,
              (t.contract_out_id = ci.contract_out_id) AS is_home,
              EXISTS (
                SELECT 1 FROM contract_in_boq_supply_link l
                  JOIN contract_in_boq b ON b.id = l.contract_in_boq_id
                  JOIN contract_out_boq ob ON ob.id = l.boq_id
                 WHERE b.contract_in_id = t.contract_in_id
                   AND ob.contract_out_id = t.contract_out_id
              ) AS has_links
         FROM contract_in_target t
         JOIN contract_in ci ON ci.id = t.contract_in_id
         JOIN contract_out co ON co.id = t.contract_out_id
        WHERE t.contract_in_id = $1
        ORDER BY is_home DESC, co.contract_date DESC NULLS LAST, co.id`,
      [contractInId])
    res.json({ items: rows, can_manage: canManage })
  } catch (err) {
    console.error('getTargets:', err)
    res.status(500).json({ error: 'Không thể tải danh sách HĐ bán liên kết' })
  }
}

// GET /contract-ins/:contractInId/target-candidates
// Danh sách HĐ bán để chọn thêm — TOÀN BỘ hệ thống (trừ cái đã link), không giới hạn theo
// thành viên như /contracts. Chỉ trả trường định danh (số HĐ, tên dự án, khách hàng): không
// có giá trị hợp đồng nên không lộ số tiền của dự án người dùng không tham gia. Route gắn
// requireTargetsManager nên chỉ người được sửa danh sách mới gọi được.
export async function getTargetCandidates(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  try {
    const { rows } = await pool.query(
      `SELECT co.id, co.contract_no, co.project_name, c.name AS customer_name
         FROM contract_out co
         LEFT JOIN customer c ON c.id = co.customer_id
        WHERE COALESCE(co.is_deleted, false) = false
          AND NOT EXISTS (
            SELECT 1 FROM contract_in_target t
             WHERE t.contract_in_id = $1 AND t.contract_out_id = co.id
          )
        ORDER BY co.contract_date DESC NULLS LAST, co.id DESC`,
      [contractInId])
    res.json(rows)
  } catch (err) {
    console.error('getTargetCandidates:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng bán' })
  }
}

// Báo cho PM của HĐ bán vừa được gắn/gỡ biết HĐ nhập nào đang cung cấp hàng cho dự án của họ.
// Chỉ để nắm tin (notifyInfo), fire-and-forget. Bỏ qua chính người thao tác.
async function notifyTargetPMs(contractInId, contractOutId, actorId, added) {
  try {
    const { rows } = await pool.query(
      `SELECT ci.contract_no AS in_no, s.name AS supplier_name, co.contract_no, co.project_name
         FROM contract_in ci
         LEFT JOIN supplier s ON s.id = ci.supplier_id
         CROSS JOIN contract_out co
        WHERE ci.id = $1 AND co.id = $2`,
      [contractInId, contractOutId])
    if (!rows.length) return

    const r = rows[0]
    const pms = (await pmUserIds(contractOutId)).filter(id => id !== actorId)
    if (!pms.length) return

    const who = await userFullName(actorId)
    const inLabel = r.in_no || `#${contractInId}`
    const outLabel = r.contract_no || r.project_name || `#${contractOutId}`
    const supplier = r.supplier_name ? ` (NCC: ${r.supplier_name})` : ''
    notifyInfo(pms, added
      ? `${who} đã gắn hợp đồng nhập ${inLabel}${supplier} cung cấp hàng cho hợp đồng bán ${outLabel} của bạn.`
      : `${who} đã bỏ gắn hợp đồng nhập ${inLabel}${supplier} khỏi hợp đồng bán ${outLabel} của bạn.`)
  } catch (err) {
    console.error('notifyTargetPMs:', err)
  }
}

// POST /contract-ins/:contractInId/targets  { contract_out_id }
// Thêm 1 HĐ bán vào tập. KHÔNG đòi người thao tác là thành viên HĐ bán đó (xem ghi chú đầu
// file) — quyền đã chốt ở route bằng requireTargetsManager; PM của HĐ bán được báo Telegram.
export async function addTarget(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  const contractOutId = parseInt(req.body?.contract_out_id)
  if (!contractOutId) return res.status(400).json({ error: 'Thiếu contract_out_id' })
  try {
    const { rows: co } = await pool.query(
      'SELECT id FROM contract_out WHERE id = $1 AND COALESCE(is_deleted, false) = false',
      [contractOutId])
    if (!co.length) return res.status(404).json({ error: 'Không tìm thấy hợp đồng bán' })

    const { rowCount } = await pool.query(
      `INSERT INTO contract_in_target (contract_in_id, contract_out_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [contractInId, contractOutId])
    invalidateContractIns(contractOutId)  // HĐ nhập nay hiện trong danh sách của HĐ bán này
    if (rowCount) notifyTargetPMs(contractInId, contractOutId, req.user.id, true)
    res.json({ success: true })
  } catch (err) {
    console.error('addTarget:', err)
    res.status(500).json({ error: 'Không thể thêm HĐ bán liên kết' })
  }
}

// DELETE /contract-ins/:contractInId/targets/:contractOutId
// Chặn nếu là HĐ bán home; chặn nếu đã có hàng nhập gắn vào Theo dõi nhập hàng của HĐ bán đó.
export async function removeTarget(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  const contractOutId = parseInt(req.params.contractOutId)
  try {
    const { rows: ci } = await pool.query(
      'SELECT contract_out_id FROM contract_in WHERE id = $1', [contractInId])
    if (!ci.length) return res.status(404).json({ error: 'Không tìm thấy hợp đồng nhập' })
    if (String(ci[0].contract_out_id) === String(contractOutId)) {
      return res.status(400).json({ error: 'Không thể bỏ liên kết HĐ bán gốc của hợp đồng nhập.' })
    }

    const { rows: linked } = await pool.query(
      `SELECT 1 FROM contract_in_boq_supply_link l
         JOIN contract_in_boq b ON b.id = l.contract_in_boq_id
         JOIN contract_out_boq ob ON ob.id = l.boq_id
        WHERE b.contract_in_id = $1 AND ob.contract_out_id = $2 LIMIT 1`,
      [contractInId, contractOutId])
    if (linked.length) {
      return res.status(400).json({
        error: 'Không thể bỏ liên kết: đã có hàng nhập gắn vào Theo dõi nhập hàng của HĐ bán này. Hãy bỏ ghép ở tab Bảng giá mua trước.',
      })
    }

    const { rowCount } = await pool.query(
      'DELETE FROM contract_in_target WHERE contract_in_id = $1 AND contract_out_id = $2',
      [contractInId, contractOutId])
    invalidateContractIns(contractOutId)  // HĐ nhập rời khỏi danh sách của HĐ bán này
    if (rowCount) notifyTargetPMs(contractInId, contractOutId, req.user.id, false)
    res.json({ success: true })
  } catch (err) {
    console.error('removeTarget:', err)
    res.status(500).json({ error: 'Không thể bỏ HĐ bán liên kết' })
  }
}
