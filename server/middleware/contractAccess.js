import { pool } from '../db.js'
import { userIsHead } from './tenderAccess.js'

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
// CHỈ tài nguyên phía HĐ bán (contract_out). Tài nguyên phía HĐ nhập (contract_in)
// dùng cơ chế "người tạo" riêng bên dưới (CI_RESOLVERS / DOC_RESOLVERS).
const RESOLVERS = {
  boq:               `SELECT contract_out_id FROM contract_out_boq WHERE id = ANY($1::bigint[])`,
  progress:          `SELECT contract_out_id FROM contract_out_progress WHERE id = ANY($1::bigint[])`,
  receivable:        `SELECT contract_out_id FROM contract_receivable WHERE id = ANY($1::bigint[])`,
  receivablePayment: `SELECT contract_out_id FROM contract_receivable_payment WHERE id = ANY($1::bigint[])`,
  guarantee:         `SELECT contract_out_id FROM contract_guarantee WHERE id = ANY($1::bigint[])`,
  invoice:           `SELECT contract_out_id FROM contract_out_invoice WHERE id = ANY($1::bigint[])`,
  task:              `SELECT contract_out_id FROM contract_task WHERE id = ANY($1::bigint[])`,
  equipment:         `SELECT contract_out_id FROM contract_equipment WHERE id = ANY($1::bigint[])`,
  outDelivery:       `SELECT contract_out_id FROM contract_out_delivery WHERE id = ANY($1::bigint[])`,
  warrantyCase:      `SELECT contract_out_id FROM warranty_case WHERE id = ANY($1::bigint[])`,

  taskAttachment: `SELECT t.contract_out_id FROM contract_task_attachment a
                     JOIN contract_task t ON t.id = a.task_id WHERE a.id = ANY($1::bigint[])`,
  serial: `SELECT e.contract_out_id FROM equipment_serial s
             JOIN contract_equipment e ON e.id = s.equipment_id WHERE s.id = ANY($1::bigint[])`,
  caseEquipment: `SELECT wc.contract_out_id FROM warranty_case_equipment ce
                    JOIN warranty_case wc ON wc.id = ce.case_id WHERE ce.id = ANY($1::bigint[])`,
  warrantyActivity: `SELECT wc.contract_out_id FROM warranty_activity a
                       JOIN warranty_case wc ON wc.id = a.case_id WHERE a.id = ANY($1::bigint[])`,
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

// roles = các member_role được phép ghi (mặc định chỉ 'PM'). Admin luôn toàn quyền.
function makeGuard(pick, resolverSql, roles = ['PM']) {
  const roleLabel = roles.includes('Technical') ? 'PM/Kỹ thuật của hợp đồng' : 'PM của hợp đồng'
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

      // User phải có 1 trong các vai trò cho phép ở TẤT CẢ hợp đồng liên quan
      // (bulk có thể chạm nhiều HĐ).
      const distinct = [...new Set(contractIds)]
      const { rows: m } = await pool.query(
        `SELECT COUNT(DISTINCT contract_out_id)::int AS n
           FROM contract_out_member
          WHERE user_id = $1 AND member_role = ANY($2) AND contract_out_id = ANY($3::bigint[])`,
        [req.user.id, roles, distinct],
      )
      if (m[0].n === distinct.length) return next()

      res.status(403).json({ error: `Chỉ ${roleLabel} (hoặc admin) mới được sửa đổi dữ liệu này.` })
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

// ─────────────────────────────────────────────────────────────────────────────
// Quyền GHI công việc có nới cho NGƯỜI ĐƯỢC GIAO (assignee) — cho phép tạo/sửa việc CON.
// Việc gốc (parent_task_id NULL) vẫn chỉ PM/admin. Việc con: PM/admin HOẶC người được
// giao việc con đó HOẶC người được giao việc CHA của nó.
// ─────────────────────────────────────────────────────────────────────────────

export async function isPmOfContract(userId, contractId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM contract_out_member
      WHERE user_id = $1 AND member_role = 'PM' AND contract_out_id = $2 LIMIT 1`,
    [userId, contractId],
  )
  return rows.length > 0
}

// POST /contracts/:id/tasks — tạo việc (hoặc việc con nếu body.parent_task_id).
export function canCreateTask(param = 'id') {
  return async function guard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin
      const contractId = String(req.params[param] ?? '')
      if (!ID_RE.test(contractId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      if (await isPmOfContract(req.user.id, contractId)) return next()

      // Không phải PM: chỉ cho khi tạo việc CON của một việc mình được giao, cùng HĐ.
      const parentId = req.body?.parent_task_id
      if (parentId != null && ID_RE.test(String(parentId))) {
        const { rows } = await pool.query(
          'SELECT contract_out_id, assigned_to FROM contract_task WHERE id = $1',
          [parentId],
        )
        const p = rows[0]
        if (p && String(p.contract_out_id) === contractId && Number(p.assigned_to) === Number(req.user.id)) {
          return next()
        }
      }
      res.status(403).json({ error: 'Chỉ PM (hoặc admin / người được giao việc cha) mới được thêm công việc.' })
    } catch (err) { next(err) }
  }
}

// PUT /contracts/:id/tasks/reorder — sắp xếp thứ tự. PM/admin sắp tuỳ ý; người được giao
// VIỆC CHA được sắp xếp các việc con của nó (orderedIds phải là anh-em cùng 1 cha non-null).
export function canReorderTasks(param = 'id') {
  return async function guard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin
      const contractId = String(req.params[param] ?? '')
      if (!ID_RE.test(contractId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      if (await isPmOfContract(req.user.id, contractId)) return next()

      const ids = (Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [])
        .map(Number).filter(Number.isFinite)
      if (!ids.length) { res.status(400).json({ error: 'orderedIds rỗng.' }); return }

      const { rows } = await pool.query(
        'SELECT id, contract_out_id, parent_task_id FROM contract_task WHERE id = ANY($1::bigint[])',
        [ids],
      )
      // Phải đủ, cùng HĐ, và cùng MỘT việc cha non-null (anh-em).
      const parents = new Set(rows.map(r => r.parent_task_id == null ? 'root' : String(r.parent_task_id)))
      if (rows.length !== ids.length
          || rows.some(r => String(r.contract_out_id) !== contractId)
          || parents.size !== 1 || parents.has('root')) {
        res.status(403).json({ error: 'Chỉ PM (hoặc admin) mới được sắp xếp các việc này.' })
        return
      }
      const { rows: pr } = await pool.query('SELECT assigned_to FROM contract_task WHERE id = $1', [rows[0].parent_task_id])
      if (pr[0] && Number(pr[0].assigned_to) === Number(req.user.id)) return next()
      res.status(403).json({ error: 'Chỉ PM (hoặc admin / người được giao việc cha) mới được sắp xếp việc con.' })
    } catch (err) { next(err) }
  }
}

// PUT|DELETE /tasks/:id — sửa/xoá việc. Nới cho assignee của việc con (hoặc của việc cha nó).
export function canWriteTask(param = 'id') {
  return async function guard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin
      const taskId = String(req.params[param] ?? '')
      if (!ID_RE.test(taskId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      const { rows } = await pool.query(
        `SELECT t.contract_out_id, t.assigned_to, t.parent_task_id, p.assigned_to AS parent_assigned_to
           FROM contract_task t
           LEFT JOIN contract_task p ON p.id = t.parent_task_id
          WHERE t.id = $1`,
        [taskId],
      )
      const t = rows[0]
      if (!t) { res.status(404).json({ error: 'Không tìm thấy công việc.' }); return }

      if (await isPmOfContract(req.user.id, String(t.contract_out_id))) return next()

      const uid = Number(req.user.id)
      const isSubtask = t.parent_task_id != null
      if (isSubtask && (Number(t.assigned_to) === uid || Number(t.parent_assigned_to) === uid)) {
        return next()
      }
      res.status(403).json({ error: 'Chỉ PM (hoặc admin / người được giao) mới được sửa công việc này.' })
    } catch (err) { next(err) }
  }
}

// PUT /tasks/:id/transfer — Chuyển việc (đổi người thực hiện). Nới rộng hơn canWriteTask:
// cho phép PM/admin, NGƯỜI TẠO việc, hoặc NGƯỜI ĐANG ĐƯỢC GIAO (kể cả việc gốc) tự chuyển
// việc của mình cho người khác.
export function canTransferTask(param = 'id') {
  return async function guard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin
      const taskId = String(req.params[param] ?? '')
      if (!ID_RE.test(taskId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      const { rows } = await pool.query(
        'SELECT contract_out_id, assigned_to, created_by FROM contract_task WHERE id = $1',
        [taskId],
      )
      const t = rows[0]
      if (!t) { res.status(404).json({ error: 'Không tìm thấy công việc.' }); return }

      const uid = Number(req.user.id)
      if (Number(t.assigned_to) === uid || Number(t.created_by) === uid) return next()
      if (await isPmOfContract(uid, String(t.contract_out_id))) return next()
      res.status(403).json({ error: 'Chỉ PM/admin, người tạo hoặc người được giao mới được chuyển việc này.' })
    } catch (err) { next(err) }
  }
}

// Biến thể cho phép PM HOẶC Kỹ thuật (member_role='Technical') — dùng cho thao tác serial.
export const pmOrTechVia = (key, param = 'id') => makeGuard(req => req.params[param], RESOLVERS[key], ['PM', 'Technical'])
export const pmOrTechViaBody = (key) => makeGuard(req => req.body?.ids, RESOLVERS[key], ['PM', 'Technical'])

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

// Đếm số HĐ bán mà user giữ vai trò `role` trong tập contract_out_id cho trước.
async function countMemberRole(userId, role, contractIds) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT contract_out_id)::int AS n FROM contract_out_member
      WHERE user_id = $1 AND member_role = $2 AND contract_out_id = ANY($3::bigint[])`,
    [userId, role, contractIds],
  )
  return rows[0].n
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

// ─────────────────────────────────────────────────────────────────────────────
// KHÓA đợt nhận hàng: khi contract_in_delivery.locked = true thì CHẶN mọi thao tác
// ghi nội dung của đợt — với TẤT CẢ (kể cả admin). Chỉ route mở/khóa (setDeliveryLock)
// mới đổi được trạng thái. Đặt guard này SAU guard quyền, TRƯỚC controller.
// ─────────────────────────────────────────────────────────────────────────────
const LOCK_RESOLVERS = {
  delivery:       `SELECT locked FROM contract_in_delivery WHERE id = ANY($1::bigint[])`,
  deliveryItem:   `SELECT d.locked FROM contract_in_delivery_item it
                     JOIN contract_in_delivery d ON d.id = it.delivery_id WHERE it.id = ANY($1::bigint[])`,
  deliverySerial: `SELECT d.locked FROM contract_in_delivery_serial s
                     JOIN contract_in_delivery_item it ON it.id = s.delivery_item_id
                     JOIN contract_in_delivery d ON d.id = it.delivery_id WHERE s.id = ANY($1::bigint[])`,
  invoice:        `SELECT locked FROM contract_out_invoice WHERE id = ANY($1::bigint[])`,
}

// label: tên hiển thị của loại đợt trong thông báo lỗi (mặc định "Đợt nhận").
function makeLockGuard(pick, resolverSql, label = 'Đợt nhận') {
  return async function lockGuard(req, res, next) {
    try {
      const ids = toIdList(pick(req))
      if (!ids) { res.status(400).json({ error: 'Tham số id không hợp lệ.' }); return }
      const { rows } = await pool.query(resolverSql, [ids])
      if (rows.some(r => r.locked)) {
        res.status(403).json({ error: `${label} đã bị khóa. Mở khóa trước khi sửa.` })
        return
      }
      next()
    } catch (err) { next(err) }
  }
}

export const blockIfLockedVia = (key, param = 'id', label) => makeLockGuard(req => req.params[param], LOCK_RESOLVERS[key], label)
export const blockIfLockedViaBody = (key, label) => makeLockGuard(req => req.body?.ids, LOCK_RESOLVERS[key], label)

// ─────────────────────────────────────────────────────────────────────────────
// Tài liệu (folder/file) dùng chung cho HĐ bán / HĐ nhập / gói thầu → phân nhánh:
//   - thuộc HĐ nhập (contract_in_id ≠ null): luật người tạo (created_by) / admin
//   - thuộc gói thầu (tender_id ≠ null):     luật làm thầu / Trưởng phòng / admin
//   - thuộc HĐ bán  (còn lại):               luật PM của HĐ bán / admin (như cũ)
// ─────────────────────────────────────────────────────────────────────────────
const DOC_RESOLVERS = {
  folder: `SELECT f.contract_in_id, f.contract_id AS contract_out_id, f.tender_id, f.item_id, ci.created_by
             FROM document_folder f LEFT JOIN contract_in ci ON ci.id = f.contract_in_id
            WHERE f.id = ANY($1::bigint[])`,
  file: `SELECT df.contract_in_id, df.contract_id AS contract_out_id, df.tender_id, df.item_id, ci.created_by
           FROM document_file df LEFT JOIN contract_in ci ON ci.id = df.contract_in_id
          WHERE df.id = ANY($1::bigint[])`,
}

// Quyền GHI tài liệu gói thầu: Trưởng phòng Đấu thầu HOẶC người làm thầu của TẤT CẢ
// gói liên quan (admin đã được lọc trước đó). Trả true nếu được phép.
async function canWriteTenderDocs(userId, userRole, tenderIds) {
  if (await userIsHead(userId, userRole)) return true
  const distinct = [...new Set(tenderIds.map(String))]
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM tender WHERE id = ANY($1::bigint[]) AND bid_maker_id = $2`,
    [distinct, userId],
  )
  return rows[0].n === distinct.length
}

// Quyền GHI tệp SẢN PHẨM (khoá item_id): Trưởng phòng, HOẶC người được giao / người
// làm thầu của gói cho TẤT CẢ đầu việc liên quan (admin đã lọc trước đó).
async function canWriteItemDocs(userId, userRole, itemIds) {
  const distinct = [...new Set(itemIds.map(String))]
  // Đầu việc đã 'Hoàn thành' → đóng băng tệp sản phẩm: không ai sửa được (kể cả Trưởng
  // phòng/người làm thầu) cho tới khi mở lại trạng thái. Chỉ admin được bỏ qua (lọc ở docGuard).
  const { rows: locked } = await pool.query(
    `SELECT 1 FROM tender_checklist_item
      WHERE id = ANY($1::bigint[]) AND status = 'Hoàn thành' LIMIT 1`,
    [distinct],
  )
  if (locked.length) return false
  if (await userIsHead(userId, userRole)) return true
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM tender_checklist_item i
       JOIN tender t ON t.id = i.tender_id
      WHERE i.id = ANY($1::bigint[])
        AND (i.assignee_id = $2 OR t.bid_maker_id = $2)`,
    [distinct, userId],
  )
  return rows[0].n === distinct.length
}

export const docGuard = (key, param = 'id') => async function docGuardMw(req, res, next) {
  try {
    if (Number(req.user?.role) === 1) return next() // admin

    const ids = toIdList(req.params[param])
    if (!ids) {
      res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      return
    }

    const { rows } = await pool.query(DOC_RESOLVERS[key], [ids])
    if (!rows.length) {
      res.status(404).json({ error: 'Không tìm thấy dữ liệu.' })
      return
    }

    const me = String(req.user.id)
    const ciRows = rows.filter(r => r.contract_in_id != null) // tài liệu HĐ nhập
    const itRows = rows.filter(r => r.contract_in_id == null && r.item_id != null) // tệp sản phẩm đầu việc
    const tdRows = rows.filter(r => r.contract_in_id == null && r.item_id == null && r.tender_id != null) // tài liệu gói thầu
    const coRows = rows.filter(r => r.contract_in_id == null && r.item_id == null && r.tender_id == null)  // tài liệu HĐ bán

    // Tài liệu HĐ nhập: phải là người tạo của tất cả HĐ nhập liên quan.
    if (!ciRows.every(r => r.created_by != null && String(r.created_by) === me)) {
      res.status(403).json({ error: 'Chỉ người tạo hợp đồng nhập (hoặc admin) mới được sửa đổi tài liệu này.' })
      return
    }

    // Tệp sản phẩm đầu việc: người được giao / làm thầu của tất cả đầu việc HOẶC Trưởng phòng.
    if (itRows.length) {
      const itemIds = itRows.map(r => r.item_id)
      if (!await canWriteItemDocs(req.user.id, req.user.role, itemIds)) {
        res.status(403).json({ error: 'Không thể sửa tệp sản phẩm: đầu việc đã hoàn thành (cần mở lại trạng thái) hoặc bạn không có quyền.' })
        return
      }
    }

    // Tài liệu gói thầu: làm thầu của tất cả gói liên quan HOẶC Trưởng phòng.
    if (tdRows.length) {
      const tenderIds = tdRows.map(r => r.tender_id)
      if (!await canWriteTenderDocs(req.user.id, req.user.role, tenderIds)) {
        res.status(403).json({ error: 'Chỉ người làm thầu của gói (hoặc Trưởng phòng) mới được sửa đổi tài liệu này.' })
        return
      }
    }

    // Tài liệu HĐ bán: phải là PM của tất cả HĐ bán liên quan.
    if (coRows.length) {
      const contractIds = [...new Set(coRows.map(r => r.contract_out_id).filter(v => v != null).map(String))]
      if (!contractIds.length || await countMemberRole(req.user.id, 'PM', contractIds) !== contractIds.length) {
        res.status(403).json({ error: 'Chỉ PM của hợp đồng (hoặc admin) mới được sửa đổi tài liệu này.' })
        return
      }
    }

    return next()
  } catch (err) {
    next(err)
  }
}
