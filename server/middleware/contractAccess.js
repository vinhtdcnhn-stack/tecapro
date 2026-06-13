import { pool } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phân quyền ghi theo hợp đồng:
// Chỉ PM của hợp đồng (contract_out_member.member_role = 'PM', gồm PM chính lẫn
// đồng PM) hoặc admin (role = 1) mới được GHI/SỬA/XOÁ các thành phần bên trong
// hợp đồng đó. Đọc (GET) vẫn mở cho mọi user đã đăng nhập theo thiết kế hiện tại
// (tra cứu chéo hợp đồng như /warranty-lookup là có chủ đích).
//
// Cách dùng trong routes:
//   pmFromParam('contractId')   — URL chứa thẳng id hợp đồng bán (contract_out)
//   pmVia('contractIn', 'id')   — URL chứa id tài nguyên con; JOIN ngược về contract_out
//   pmViaBody('boq')            — bulk: body { ids: [...] } chứa id con
//
// Với upload, đặt guard TRƯỚC multer để request không có quyền không ghi file ra đĩa.
// ─────────────────────────────────────────────────────────────────────────────

const ID_RE = /^\d+$/

// Mỗi câu SQL nhận $1 = mảng id con, trả về các contract_out_id tương ứng.
// Tài nguyên của hợp đồng nhập (contract_in) JOIN qua contract_in để về contract_out.
const RESOLVERS = {
  contractIn:        `SELECT contract_out_id FROM contract_in WHERE id = ANY($1::bigint[])`,
  boq:               `SELECT contract_out_id FROM contract_out_boq WHERE id = ANY($1::bigint[])`,
  progress:          `SELECT contract_out_id FROM contract_out_progress WHERE id = ANY($1::bigint[])`,
  receivable:        `SELECT contract_out_id FROM contract_receivable WHERE id = ANY($1::bigint[])`,
  receivablePayment: `SELECT contract_out_id FROM contract_receivable_payment WHERE id = ANY($1::bigint[])`,
  guarantee:         `SELECT contract_out_id FROM contract_guarantee WHERE id = ANY($1::bigint[])`,
  task:              `SELECT contract_out_id FROM contract_task WHERE id = ANY($1::bigint[])`,
  equipment:         `SELECT contract_out_id FROM contract_equipment WHERE id = ANY($1::bigint[])`,
  warrantyCase:      `SELECT contract_out_id FROM warranty_case WHERE id = ANY($1::bigint[])`,

  // Folder/file tài liệu dùng chung cho cả HĐ bán (contract_id) lẫn HĐ nhập (contract_in_id)
  folder: `SELECT COALESCE(f.contract_id, ci.contract_out_id) AS contract_out_id
             FROM document_folder f
             LEFT JOIN contract_in ci ON ci.id = f.contract_in_id
            WHERE f.id = ANY($1::bigint[])`,
  file: `SELECT COALESCE(df.contract_id, ci.contract_out_id) AS contract_out_id
           FROM document_file df
           LEFT JOIN contract_in ci ON ci.id = df.contract_in_id
          WHERE df.id = ANY($1::bigint[])`,

  taskAttachment: `SELECT t.contract_out_id FROM contract_task_attachment a
                     JOIN contract_task t ON t.id = a.task_id WHERE a.id = ANY($1::bigint[])`,
  serial: `SELECT e.contract_out_id FROM equipment_serial s
             JOIN contract_equipment e ON e.id = s.equipment_id WHERE s.id = ANY($1::bigint[])`,
  caseEquipment: `SELECT wc.contract_out_id FROM warranty_case_equipment ce
                    JOIN warranty_case wc ON wc.id = ce.case_id WHERE ce.id = ANY($1::bigint[])`,
  warrantyActivity: `SELECT wc.contract_out_id FROM warranty_activity a
                       JOIN warranty_case wc ON wc.id = a.case_id WHERE a.id = ANY($1::bigint[])`,

  progressIn: `SELECT ci.contract_out_id FROM contract_in_progress p
                 JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  inBoq: `SELECT ci.contract_out_id FROM contract_in_boq b
            JOIN contract_in ci ON ci.id = b.contract_in_id WHERE b.id = ANY($1::bigint[])`,
  delivery: `SELECT ci.contract_out_id FROM contract_in_delivery d
               JOIN contract_in ci ON ci.id = d.contract_in_id WHERE d.id = ANY($1::bigint[])`,
  deliveryItem: `SELECT ci.contract_out_id FROM contract_in_delivery_item it
                   JOIN contract_in_delivery d ON d.id = it.delivery_id
                   JOIN contract_in ci ON ci.id = d.contract_in_id WHERE it.id = ANY($1::bigint[])`,
  deliverySerial: `SELECT ci.contract_out_id FROM contract_in_delivery_serial s
                     JOIN contract_in_delivery_item it ON it.id = s.delivery_item_id
                     JOIN contract_in_delivery d ON d.id = it.delivery_id
                     JOIN contract_in ci ON ci.id = d.contract_in_id WHERE s.id = ANY($1::bigint[])`,
  payable: `SELECT ci.contract_out_id FROM contract_in_payable p
              JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  payment: `SELECT ci.contract_out_id FROM contract_in_payment p
              JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  supplierWarranty: `SELECT ci.contract_out_id FROM contract_in_supplier_warranty w
                       JOIN contract_in ci ON ci.id = w.contract_in_id WHERE w.id = ANY($1::bigint[])`,
  warrantyClaim: `SELECT ci.contract_out_id FROM contract_in_warranty_claim c
                    JOIN contract_in ci ON ci.id = c.contract_in_id WHERE c.id = ANY($1::bigint[])`,
  inGuarantee: `SELECT ci.contract_out_id FROM contract_in_guarantee g
                  JOIN contract_in ci ON ci.id = g.contract_in_id WHERE g.id = ANY($1::bigint[])`,
  customs: `SELECT ci.contract_out_id FROM contract_in_customs c
              JOIN contract_in ci ON ci.id = c.contract_in_id WHERE c.id = ANY($1::bigint[])`,
  logistics: `SELECT ci.contract_out_id FROM contract_in_logistics l
                JOIN contract_in ci ON ci.id = l.contract_in_id WHERE l.id = ANY($1::bigint[])`,
  logisticsUpdate: `SELECT ci.contract_out_id FROM contract_in_logistics_update u
                      JOIN contract_in_logistics l ON l.id = u.logistics_id
                      JOIN contract_in ci ON ci.id = l.contract_in_id WHERE u.id = ANY($1::bigint[])`,
}

// Chuẩn hóa input thành mảng id dạng chuỗi số; trả null nếu có phần tử không hợp lệ.
function toIdList(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  if (!arr.length) return null
  const out = []
  for (const v of arr) {
    const s = String(v ?? '').trim()
    if (!ID_RE.test(s)) return null
    out.push(s)
  }
  return out
}

function makeGuard(pick, resolverSql) {
  return async function pmGuard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin: toàn quyền

      const ids = toIdList(pick(req))
      if (!ids) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }

      let contractIds = ids
      if (resolverSql) {
        const { rows } = await pool.query(resolverSql, [ids])
        contractIds = rows.map(r => r.contract_out_id).filter(v => v != null).map(String)
        if (!contractIds.length) {
          res.status(404).json({ error: 'Không tìm thấy dữ liệu.' })
          return
        }
      }

      // User phải là PM của TẤT CẢ hợp đồng liên quan (bulk có thể chạm nhiều HĐ)
      const distinct = [...new Set(contractIds)]
      const { rows: m } = await pool.query(
        `SELECT COUNT(DISTINCT contract_out_id)::int AS n
           FROM contract_out_member
          WHERE user_id = $1 AND member_role = 'PM' AND contract_out_id = ANY($2::bigint[])`,
        [req.user.id, distinct],
      )
      if (m[0].n === distinct.length) return next()

      res.status(403).json({ error: 'Chỉ PM của hợp đồng (hoặc admin) mới được sửa đổi dữ liệu này.' })
    } catch (err) {
      next(err)
    }
  }
}

// URL chứa thẳng id hợp đồng bán
export const pmFromParam = (param = 'contractId') => makeGuard(req => req.params[param], null)

// URL chứa id tài nguyên con — JOIN ngược về contract_out theo RESOLVERS[key]
export const pmVia = (key, param = 'id') => makeGuard(req => req.params[param], RESOLVERS[key])

// Bulk: body { ids: [...] } chứa id con
export const pmViaBody = (key) => makeGuard(req => req.body?.ids, RESOLVERS[key])
