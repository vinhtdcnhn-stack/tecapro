import { pool } from '../db.js'
import { invalidateContractIns } from './contractInController.js'

// Quản lý tập HĐ bán mà 1 HĐ nhập "nhập cho" (contract_in_target). Tối thiểu 1 (HĐ bán home
// nơi tạo HĐ nhập — luôn có mặt, không xóa được). Thêm/bớt để mở rộng danh sách target ở
// cột "Nhập cho" (bảng giá mua) và để HĐ nhập hiện trong danh sách HĐ nhập của HĐ bán được link.
//
// Quyền GHI (add/remove) = chủ HĐ nhập (created_by) / admin — do route gắn ownerOfContractIn.

// GET /contract-ins/:contractInId/targets
// Trả các HĐ bán đã link kèm cờ is_home (không xóa được) và has_links (đã có hàng gắn vào
// Theo dõi nhập hàng của HĐ bán đó → cũng không xóa được).
export async function getTargets(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  try {
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
    res.json(rows)
  } catch (err) {
    console.error('getTargets:', err)
    res.status(500).json({ error: 'Không thể tải danh sách HĐ bán liên kết' })
  }
}

// POST /contract-ins/:contractInId/targets  { contract_out_id }
// Thêm 1 HĐ bán vào tập. Người dùng phải có quyền XEM HĐ bán đó (admin, hoặc thành viên
// contract_out_member) — tránh gắn HĐ nhập vào HĐ bán mình không được phép.
export async function addTarget(req, res) {
  const contractInId = parseInt(req.params.contractInId)
  const contractOutId = parseInt(req.body?.contract_out_id)
  if (!contractOutId) return res.status(400).json({ error: 'Thiếu contract_out_id' })
  try {
    const { rows: co } = await pool.query(
      'SELECT id FROM contract_out WHERE id = $1 AND COALESCE(is_deleted, false) = false',
      [contractOutId])
    if (!co.length) return res.status(404).json({ error: 'Không tìm thấy hợp đồng bán' })

    if (Number(req.user?.role) !== 1) {
      const { rows: mem } = await pool.query(
        'SELECT 1 FROM contract_out_member WHERE contract_out_id = $1 AND user_id = $2 LIMIT 1',
        [contractOutId, req.user.id])
      if (!mem.length) {
        return res.status(403).json({ error: 'Bạn không có quyền với hợp đồng bán này.' })
      }
    }

    await pool.query(
      `INSERT INTO contract_in_target (contract_in_id, contract_out_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [contractInId, contractOutId])
    invalidateContractIns(contractOutId)  // HĐ nhập nay hiện trong danh sách của HĐ bán này
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

    await pool.query(
      'DELETE FROM contract_in_target WHERE contract_in_id = $1 AND contract_out_id = $2',
      [contractInId, contractOutId])
    invalidateContractIns(contractOutId)  // HĐ nhập rời khỏi danh sách của HĐ bán này
    res.json({ success: true })
  } catch (err) {
    console.error('removeTarget:', err)
    res.status(500).json({ error: 'Không thể bỏ HĐ bán liên kết' })
  }
}
