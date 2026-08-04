import { pool } from '../db.js'
import { toIdList, makeGuard, isPmOfContract, countMemberRole } from './guardUtils.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phân quyền theo NGƯỜI TẠO cho HỢP ĐỒNG NHẬP (contract_in).
// HĐ nhập thuộc sở hữu của người tạo (contract_in.created_by): chỉ người tạo HOẶC
// admin mới được GHI/SỬA/XOÁ HĐ nhập và mọi tài nguyên con. PM của HĐ bán cha KHÔNG
// còn quyền chéo (trừ HĐ nhập do chính họ tạo / dữ liệu cũ đã backfill về PM chính).
// Riêng các thao tác SERIAL còn cho phép Kỹ thuật (Technical) của HĐ bán cha.
//
// TẠO HĐ nhập: thành viên PM HOẶC ImportExport của HĐ bán cha (hoặc admin).
// ─────────────────────────────────────────────────────────────────────────────

// Mỗi câu nhận $1 = mảng id con; trả { created_by, contract_out_id } của HĐ nhập sở hữu.
const CI_RESOLVERS = {
  self:           `SELECT created_by, contract_out_id FROM contract_in WHERE id = ANY($1::bigint[])`,
  inBoq:          `SELECT ci.created_by, ci.contract_out_id FROM contract_in_boq b
                     JOIN contract_in ci ON ci.id = b.contract_in_id WHERE b.id = ANY($1::bigint[])`,
  supplyLink:     `SELECT ci.created_by, ci.contract_out_id FROM contract_in_boq_supply_link l
                     JOIN contract_in_boq b ON b.id = l.contract_in_boq_id
                     JOIN contract_in ci ON ci.id = b.contract_in_id WHERE l.id = ANY($1::bigint[])`,
  progressIn:     `SELECT ci.created_by, ci.contract_out_id FROM contract_in_progress p
                     JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  delivery:       `SELECT ci.created_by, ci.contract_out_id FROM contract_in_delivery d
                     JOIN contract_in ci ON ci.id = d.contract_in_id WHERE d.id = ANY($1::bigint[])`,
  deliveryItem:   `SELECT ci.created_by, ci.contract_out_id FROM contract_in_delivery_item it
                     JOIN contract_in_delivery d ON d.id = it.delivery_id
                     JOIN contract_in ci ON ci.id = d.contract_in_id WHERE it.id = ANY($1::bigint[])`,
  deliverySerial: `SELECT ci.created_by, ci.contract_out_id FROM contract_in_delivery_serial s
                     JOIN contract_in_delivery_item it ON it.id = s.delivery_item_id
                     JOIN contract_in_delivery d ON d.id = it.delivery_id
                     JOIN contract_in ci ON ci.id = d.contract_in_id WHERE s.id = ANY($1::bigint[])`,
  payable:        `SELECT ci.created_by, ci.contract_out_id FROM contract_in_payable p
                     JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  payment:        `SELECT ci.created_by, ci.contract_out_id FROM contract_in_payment p
                     JOIN contract_in ci ON ci.id = p.contract_in_id WHERE p.id = ANY($1::bigint[])`,
  supplierWarranty: `SELECT ci.created_by, ci.contract_out_id FROM contract_in_supplier_warranty w
                       JOIN contract_in ci ON ci.id = w.contract_in_id WHERE w.id = ANY($1::bigint[])`,
  warrantyClaim:  `SELECT ci.created_by, ci.contract_out_id FROM contract_in_warranty_claim c
                     JOIN contract_in ci ON ci.id = c.contract_in_id WHERE c.id = ANY($1::bigint[])`,
  inGuarantee:    `SELECT ci.created_by, ci.contract_out_id FROM contract_in_guarantee g
                     JOIN contract_in ci ON ci.id = g.contract_in_id WHERE g.id = ANY($1::bigint[])`,
  customs:        `SELECT ci.created_by, ci.contract_out_id FROM contract_in_customs c
                     JOIN contract_in ci ON ci.id = c.contract_in_id WHERE c.id = ANY($1::bigint[])`,
  logistics:      `SELECT ci.created_by, ci.contract_out_id FROM contract_in_logistics l
                     JOIN contract_in ci ON ci.id = l.contract_in_id WHERE l.id = ANY($1::bigint[])`,
  logisticsUpdate: `SELECT ci.created_by, ci.contract_out_id FROM contract_in_logistics_update u
                      JOIN contract_in_logistics l ON l.id = u.logistics_id
                      JOIN contract_in ci ON ci.id = l.contract_in_id WHERE u.id = ANY($1::bigint[])`,
}

// allowTech=true: ngoài người tạo, Kỹ thuật của HĐ bán cha cũng được (dùng cho serial).
function makeOwnerGuard(pick, resolverSql, { allowTech = false } = {}) {
  return async function ownerGuard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin: toàn quyền

      const ids = toIdList(pick(req))
      if (!ids) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }

      const { rows } = await pool.query(resolverSql, [ids])
      if (!rows.length) {
        res.status(404).json({ error: 'Không tìm thấy dữ liệu.' })
        return
      }

      const me = String(req.user.id)
      // Người tạo của TẤT CẢ HĐ nhập liên quan (bulk có thể chạm nhiều HĐ).
      if (rows.every(r => r.created_by != null && String(r.created_by) === me)) return next()

      if (allowTech) {
        const contractIds = [...new Set(rows.map(r => r.contract_out_id).filter(v => v != null).map(String))]
        if (contractIds.length && await countMemberRole(req.user.id, 'Technical', contractIds) === contractIds.length) {
          return next()
        }
      }

      res.status(403).json({ error: 'Chỉ người tạo hợp đồng nhập (hoặc admin) mới được sửa đổi dữ liệu này.' })
    } catch (err) {
      next(err)
    }
  }
}

// PUT/DELETE chính HĐ nhập, hoặc POST tạo tài nguyên con dưới :contractInId
export const ownerOfContractIn = (param = 'contractInId') => makeOwnerGuard(req => req.params[param], CI_RESOLVERS.self)
// PUT/DELETE tài nguyên con HĐ nhập (id con → JOIN về contract_in.created_by)
export const ownerVia = (key, param = 'id') => makeOwnerGuard(req => req.params[param], CI_RESOLVERS[key])
export const ownerViaBody = (key) => makeOwnerGuard(req => req.body?.ids, CI_RESOLVERS[key])
// Biến thể serial: người tạo HOẶC Kỹ thuật của HĐ bán cha
export const ownerOrTechVia = (key, param = 'id') => makeOwnerGuard(req => req.params[param], CI_RESOLVERS[key], { allowTech: true })
export const ownerOrTechViaBody = (key) => makeOwnerGuard(req => req.body?.ids, CI_RESOLVERS[key], { allowTech: true })

// Tạo HĐ nhập: URL chứa thẳng id HĐ bán; cho PM hoặc ImportExport của HĐ bán (hoặc admin).
export const canCreateContractIn = makeGuard(req => req.params.id, null, ['PM', 'ImportExport'])

// Sửa tập "Nhập cho" (contract_in_target) của 1 HĐ nhập: admin, NGƯỜI TẠO HĐ nhập, hoặc
// PM của HĐ bán GỐC (home) của HĐ nhập đó.
//
// Cố ý nới hơn ownerOfContractIn: một HĐ nhập thường phục vụ HĐ bán của PM khác, mà PM đó
// lại không mở được HĐ nhập (không phải thành viên HĐ bán gốc). Nếu vừa bắt "phải là người
// tạo HĐ nhập" vừa bắt "phải là thành viên HĐ bán được thêm" thì hai điều kiện loại trừ nhau
// và KHÔNG ai gắn được. Nay: người phụ trách HĐ nhập / PM HĐ bán gốc gắn tới HĐ bán BẤT KỲ,
// và PM của HĐ bán bị gắn được báo Telegram để biết (xem addTarget).
// Predicate dùng chung cho guard (ghi) và cho cờ can_manage trả về client (ẩn/hiện ô thêm).
export async function canManageContractInTargets(user, contractInId) {
  if (Number(user?.role) === 1) return true
  if (!contractInId || !user?.id) return false

  const { rows } = await pool.query(
    'SELECT created_by, contract_out_id FROM contract_in WHERE id = $1', [contractInId])
  if (!rows.length) return false

  const { created_by, contract_out_id } = rows[0]
  if (created_by != null && String(created_by) === String(user.id)) return true
  return contract_out_id != null && await isPmOfContract(user.id, contract_out_id)
}

// PUT /purchase-boq/:id/supply-links — cột "Nhập cho": ghép dòng hàng nhập vào hàng bán của
// HĐ bán `body.contract_out_id`. Ngoài chủ HĐ nhập/admin, cho **PM của chính HĐ bán đó** tự
// ghép hàng cho dự án mình (HĐ nhập thường do người khác tạo). An toàn vì controller
// setLinksForInBoqRow chỉ xóa/ghi ghép TRONG phạm vi contract_out_id đó, đòi HĐ bán phải là
// target của HĐ nhập, và đòi mọi boq_id thuộc đúng HĐ bán đó — PM không chạm được HĐ bán khác.
export const canLinkSupplyForContractOut = (param = 'id') =>
  async function supplyLinkGuard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin: toàn quyền

      const inBoqId = parseInt(req.params[param])
      if (!inBoqId) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }

      const { rows } = await pool.query(
        `SELECT ci.created_by, ci.contract_out_id AS home_out
           FROM contract_in_boq b JOIN contract_in ci ON ci.id = b.contract_in_id
          WHERE b.id = $1`, [inBoqId])
      if (!rows.length) {
        res.status(404).json({ error: 'Không tìm thấy dòng bảng giá nhập.' })
        return
      }

      const { created_by, home_out } = rows[0]
      if (created_by != null && String(created_by) === String(req.user.id)) return next()

      const scopeOut = req.body?.contract_out_id ? parseInt(req.body.contract_out_id) : home_out
      if (scopeOut != null && await isPmOfContract(req.user.id, scopeOut)) return next()

      res.status(403).json({
        error: 'Chỉ người tạo hợp đồng nhập, PM của hợp đồng bán đang xem (hoặc admin) mới ghép được hàng.',
      })
    } catch (err) {
      next(err)
    }
  }

export const requireTargetsManager = (param = 'contractInId') =>
  async function targetsGuard(req, res, next) {
    try {
      const contractInId = parseInt(req.params[param])
      if (!contractInId) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      if (await canManageContractInTargets(req.user, contractInId)) return next()
      res.status(403).json({
        error: 'Chỉ người tạo hợp đồng nhập, PM của hợp đồng bán gốc (hoặc admin) mới sửa được danh sách này.',
      })
    } catch (err) {
      next(err)
    }
  }
