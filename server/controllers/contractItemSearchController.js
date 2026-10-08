import { pool } from '../db.js'

// Bỏ dấu tiếng Việt để tìm "may chu" vẫn ra "Máy chủ" (DB không có extension unaccent →
// dùng translate() với bảng ký tự cố định, phía JS chuẩn hóa từ khóa theo cùng quy tắc).
const VN_FROM = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
const VN_TO   = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const escLike = (s) => s.replace(/[\\%_]/g, (m) => '\\' + m)

// GET /contracts/search-items?q=... — tìm HĐ bán theo TÊN HÀNG HÓA trong bảng giá.
// Trả về [{ contract_out_id, match_count }]; FE giao với danh sách HĐ đang hiển thị.
// Phạm vi giống danh sách HĐ: admin thấy hết, còn lại chỉ HĐ mình là thành viên. Chỉ trả id +
// số dòng khớp (không trả tên hàng/giá) để không lộ nội dung bảng giá ngoài quyền tab Bảng giá.
export async function searchContractsByItem(req, res) {
  const q = fold(String(req.query.q || '').trim())
  if (q.length < 2) return res.json([])
  try {
    const params = [`%${escLike(q)}%`, VN_FROM, VN_TO]
    let memberFilter = ''
    if (Number(req.user?.role) !== 1) {
      params.push(req.user.id)
      memberFilter = `AND EXISTS (SELECT 1 FROM contract_out_member m
                                  WHERE m.contract_out_id = co.id AND m.user_id = $4)`
    }
    const { rows } = await pool.query(`
      SELECT b.contract_out_id, COUNT(*)::int AS match_count
      FROM contract_out_boq b
      JOIN contract_out co ON co.id = b.contract_out_id
      WHERE COALESCE(co.is_deleted, false) = false
        AND translate(lower(b.item_name), $2, $3) LIKE $1
        ${memberFilter}
      GROUP BY b.contract_out_id
    `, params)
    res.json(rows.map(r => ({ contract_out_id: String(r.contract_out_id), match_count: r.match_count })))
  } catch (err) {
    console.error('searchContractsByItem:', err)
    res.status(500).json({ error: 'Lỗi tìm theo hàng hóa' })
  }
}
