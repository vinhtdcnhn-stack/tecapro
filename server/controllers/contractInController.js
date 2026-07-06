import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified, invalidateContract, invalidateContractMembers, invalidateReports } from '../services/cacheKeys.js'

const TAB_TTL = 15 * 60 // 15'

// Danh sách HĐ nhập đổi → tab contract-ins của HĐ bán + dashboard thành viên + báo cáo công nợ phải trả.
export function invalidateContractIns(contractOutId) {
  invalidateContract(contractOutId, 'contract-ins')
  invalidateContractMembers(contractOutId)
  invalidateReports('debt')
}

// 1 HĐ nhập có thể nhập cho NHIỀU HĐ bán (contract_in_target) → khi dữ liệu HĐ nhập đổi
// (BOQ/giá trị, thêm/bớt HĐ bán link) thì làm tươi danh sách 'contract-ins' của MỌI HĐ bán
// đang link tới nó, không chỉ HĐ bán home.
export async function invalidateContractInAllTargets(contractInId) {
  const { rows } = await pool.query(
    'SELECT contract_out_id FROM contract_in_target WHERE contract_in_id = $1', [contractInId])
  for (const r of rows) invalidateContractIns(r.contract_out_id)
}

// Giá trị HĐ nhập do bảng giá mua quyết định (xem syncContractInTotal). Tính thẳng
// từ tổng BOQ ở đây để list/header luôn khớp bảng giá, kể cả dữ liệu cũ chưa sync
// (cột ci.amount có thể còn giá trị nhập tay cũ). Alias "amount" đặt SAU ci.* để
// đè cột amount gốc trong kết quả; fallback về ci.amount khi HĐ chưa có dòng BOQ nào.
const BASE_SELECT = `
  SELECT
    ci.*,
    COALESCE(
      (SELECT SUM(b.amount_after_vat) FROM contract_in_boq b WHERE b.contract_in_id = ci.id),
      ci.amount
    ) AS amount,
    s.name  AS supplier_name,
    s.code  AS supplier_code
  FROM contract_in ci
  LEFT JOIN supplier s ON s.id = ci.supplier_id
`

export async function getContractIns(req, res) {
  const contractOutId = parseInt(req.params.id)
  try {
    if (await contractTabNotModified(req, res, contractOutId, 'contract-ins')) return
    const rows = await cacheWrap(contractKey(contractOutId, 'contract-ins'), TAB_TTL, async () => {
      // 1 HĐ nhập nhập cho NHIỀU HĐ bán (contract_in_target). Danh sách của HĐ bán này gồm
      // MỌI HĐ nhập có target trỏ tới nó (kể cả HĐ nhập "home" ở HĐ bán khác) — không chỉ
      // theo ci.contract_out_id nữa.
      const { rows } = await pool.query(
        `${BASE_SELECT}
          WHERE ci.id IN (SELECT contract_in_id FROM contract_in_target WHERE contract_out_id = $1)
          ORDER BY ci.contract_date DESC, ci.id DESC`,
        [contractOutId]
      )
      if (!rows.length) return rows
      // Gắn cờ "dùng chung": HĐ nhập link ≥2 HĐ bán → is_shared + số HĐ bán khác (badge).
      const ids = rows.map(r => r.id)
      const { rows: tgs } = await pool.query(
        `SELECT cit.contract_in_id, cit.contract_out_id, co.contract_no
           FROM contract_in_target cit
           JOIN contract_out co ON co.id = cit.contract_out_id
          WHERE cit.contract_in_id = ANY($1::int[])`, [ids])
      const byCi = new Map()
      for (const t of tgs) {
        if (!byCi.has(t.contract_in_id)) byCi.set(t.contract_in_id, [])
        byCi.get(t.contract_in_id).push(t)
      }
      for (const r of rows) {
        const list = byCi.get(r.id) || []
        r.is_shared = list.length > 1
        r.other_contract_nos = list
          .filter(t => String(t.contract_out_id) !== String(contractOutId))
          .map(t => t.contract_no)
          .filter(Boolean)
      }
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getContractIns:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng nhập' })
  }
}

export async function createContractIn(req, res) {
  const contractOutId = parseInt(req.params.id)
  const { contract_no, goods_type, contract_date, supplier_id, amount, currency_code, exchange_rate, purchase_type, status, note } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO contract_in
         (contract_out_id, contract_no, goods_type, contract_date, supplier_id, amount, currency_code, exchange_rate, purchase_type, status, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [contractOutId, contract_no?.trim()||null, goods_type?.trim()||null,
       contract_date||null, supplier_id||null,
       parseFloat(amount)||0, currency_code||'VND',
       exchange_rate ? parseFloat(exchange_rate) : null,
       purchase_type||'Trong nước', status||'Active', note?.trim()||null, req.user?.id || null]
    )
    // HĐ bán tạo ra HĐ nhập luôn là 1 target (home) — luôn có mặt, không xóa được.
    await client.query(
      `INSERT INTO contract_in_target (contract_in_id, contract_out_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`, [rows[0].id, contractOutId])
    await client.query('COMMIT')
    const full = await pool.query(`${BASE_SELECT} WHERE ci.id = $1`, [rows[0].id])
    invalidateContractIns(contractOutId)
    res.json(full.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('createContractIn:', err)
    res.status(500).json({ error: 'Không thể tạo hợp đồng nhập' })
  } finally {
    client.release()
  }
}

export async function updateContractIn(req, res) {
  const id = parseInt(req.params.id)
  // amount KHÔNG nhận từ body: giá trị HĐ nhập do bảng giá mua quyết định (syncContractInTotal).
  const { contract_no, goods_type, contract_date, supplier_id, currency_code, exchange_rate, purchase_type, status, note } = req.body
  try {
    await pool.query(
      `UPDATE contract_in SET
         contract_no=$1, goods_type=$2, contract_date=$3, supplier_id=$4,
         currency_code=$5, exchange_rate=$6, purchase_type=$7,
         status=$8, note=$9, updated_at=NOW()
       WHERE id=$10`,
      [contract_no?.trim()||null, goods_type?.trim()||null,
       contract_date||null, supplier_id||null,
       currency_code||'VND',
       exchange_rate ? parseFloat(exchange_rate) : null,
       purchase_type||'Trong nước', status||'Active', note?.trim()||null, id]
    )
    const full = await pool.query(`${BASE_SELECT} WHERE ci.id = $1`, [id])
    if (!full.rows[0]) return res.status(404).json({ error: 'Không tìm thấy hợp đồng nhập' })
    await invalidateContractInAllTargets(id)  // làm tươi list của mọi HĐ bán đang link
    res.json(full.rows[0])
  } catch (err) {
    console.error('updateContractIn:', err)
    res.status(500).json({ error: 'Không thể cập nhật hợp đồng nhập' })
  }
}

export async function deleteContractIn(req, res) {
  const id = parseInt(req.params.id)
  try {
    // Gom mọi HĐ bán đang link TRƯỚC khi xóa (targets bị CASCADE cùng HĐ nhập).
    const { rows: tgs } = await pool.query(
      'SELECT contract_out_id FROM contract_in_target WHERE contract_in_id = $1', [id])
    const { rows } = await pool.query('DELETE FROM contract_in WHERE id=$1 RETURNING contract_out_id', [id])
    if (rows[0]) {
      const outs = new Set(tgs.map(t => String(t.contract_out_id)))
      outs.add(String(rows[0].contract_out_id))
      for (const co of outs) invalidateContractIns(co)
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa hợp đồng nhập' })
  }
}
