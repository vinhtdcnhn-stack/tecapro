import { pool } from '../db.js'
import {
  KIND, normKind, recomputeTree, subtreeInvoicedQty, ancestorSystemInvoicedQty,
} from './boqTreeUtils.js'
import { excelUpload, downloadBOQTemplate } from './boqExcel.js'
import {
  getContractCurrency, buildRowFields, promoteParentToGroup, invoicedQty, validateSiblingName,
} from './boqHelpers.js'
import { rejectIfStale } from '../utils/staleGuard.js'
import { cacheWrap } from '../cache.js'
import { verifyUserPassword } from '../auth/verifyPassword.js'
import { contractKey, contractTabNotModified, invalidateContract, invalidateContractMembers, invalidateReports } from '../services/cacheKeys.js'

export { excelUpload, downloadBOQTemplate }
export { importBOQPreview, saveImportedBOQ } from './boqImportController.js'

const BOQ_TTL = 30 * 60 // 30'

// BOQ đổi → tab boq + tóm tắt hóa đơn (SL còn lại) + thông tin HĐ (tổng tiền recomputeTree)
// + báo cáo công nợ (tổng HĐ) + dashboard thành viên. Dùng cho mọi thao tác ghi BOQ.
export function invalidateBOQ(contractId) {
  if (contractId == null) return
  invalidateContract(contractId, 'boq', 'invoice-summary', 'info')
  invalidateContractMembers(contractId)
  invalidateReports('debt')
}

// Đồng bộ tổng + roll-up cây bảng giá → contract_out qua recomputeTree (boqTreeUtils):
// tính lại số tiền cho node nhóm/zone và đặt tổng HĐ = SUM các dòng lá.
// Các helper dùng chung (currency, buildRowFields, validateSiblingName…) ở boqHelpers.js.

// ── GET /contracts/:contractId/boq ────────────────────────────────────────────

export async function getBOQ(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.contractId, 'boq')) return
    const rows = await cacheWrap(contractKey(req.params.contractId, 'boq'), BOQ_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM public.contract_out_boq WHERE contract_out_id = $1 ORDER BY sort_order, id',
        [req.params.contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getBOQ:', err)
    res.status(500).json({ error: 'Failed to get BOQ' })
  }
}

// ── PATCH /contracts/:contractId/boq-lock ─ khóa/mở khóa toàn bộ bảng giá ─────
// Chỉ Trưởng/Phó ban của HĐ (co.boq.lock) + admin (gác ở route). Khi locked=true, mọi
// thao tác ghi bảng giá bị chặn (blockIfLocked) tới khi mở. MỞ KHÓA buộc nhập lại mật khẩu.
export async function setBOQLock(req, res) {
  const { contractId } = req.params
  const locked = !!req.body.locked
  try {
    if (!locked) {
      const ok = await verifyUserPassword(req.user.id, req.body.password)
      if (!ok) return res.status(401).json({ error: 'Mật khẩu không đúng.' })
    }
    const { rows } = await pool.query(`
      WITH upd AS (
        UPDATE public.contract_out
          SET boq_locked = $1, boq_locked_by = $2, boq_locked_at = $3
        WHERE id = $4 RETURNING id, boq_locked, boq_locked_at, boq_locked_by
      )
      SELECT upd.id, upd.boq_locked, upd.boq_locked_at, lu.full_name AS boq_locked_by_name
      FROM upd LEFT JOIN public.app_user lu ON lu.id = upd.boq_locked_by
    `, [locked, locked ? req.user.id : null, locked ? new Date() : null, contractId])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy hợp đồng.' })
    invalidateContract(contractId, 'info') // trạng thái khóa nằm trong info (getContractById)
    res.json(rows[0])
  } catch (err) {
    console.error('setBOQLock:', err)
    res.status(500).json({ error: 'Không thể đổi trạng thái khóa bảng giá.' })
  }
}

// ── POST /contracts/:contractId/boq  (append at end) ─────────────────────────

export async function createBOQItem(req, res) {
  try {
    const { contractId } = req.params
    const { parent_id } = req.body
    const kind = normKind(req.body.row_kind)

    const nameErr = await validateSiblingName({ contractId, parentId: parent_id || null, itemName: req.body.item_name })
    if (nameErr) return res.status(400).json({ error: nameErr })

    // Next sort_order
    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_out_boq WHERE contract_out_id = $1',
      [contractId]
    )
    const sortOrder = Number(mx[0].m) + 1

    const currency = await getContractCurrency(contractId)
    const fields = buildRowFields(req.body, kind, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_out_boq
        (contract_out_id, sort_order, parent_id, row_kind, item_name, hs_code, unit, quantity,
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type, multiply_qty, hide_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [contractId, sortOrder, parent_id || null, kind,
        fields.item_name, fields.hs_code, fields.unit, fields.quantity,
        fields.price, fields.before, fields.vat_rate, fields.after, fields.warranty_period, fields.item_type, fields.multiply_qty, fields.hide_amount])

    await promoteParentToGroup(parent_id, pool)
    await recomputeTree(contractId)
    invalidateBOQ(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createBOQItem:', err)
    res.status(500).json({ error: 'Failed to create BOQ item' })
  }
}

// ── POST /contracts/:contractId/boq/after/:refId  (insert after row) ─────────

export async function insertBOQAfter(req, res) {
  try {
    const { contractId, refId } = req.params
    const kind = normKind(req.body.row_kind)

    // Get sort_order + parent of reference row (dòng mới là anh-em cùng cấp với dòng tham chiếu)
    const { rows: ref } = await pool.query(
      'SELECT sort_order, parent_id FROM public.contract_out_boq WHERE id = $1 AND contract_out_id = $2',
      [refId, contractId]
    )
    if (!ref.length) return res.status(404).json({ error: 'Reference row not found' })

    const refSort = Number(ref[0].sort_order)
    const parentId = req.body.parent_id !== undefined ? (req.body.parent_id || null) : ref[0].parent_id

    const nameErr = await validateSiblingName({ contractId, parentId, itemName: req.body.item_name })
    if (nameErr) return res.status(400).json({ error: nameErr })

    // Shift all rows after the reference row
    await pool.query(
      'UPDATE public.contract_out_boq SET sort_order = sort_order + 1 WHERE contract_out_id = $1 AND sort_order > $2',
      [contractId, refSort]
    )

    const currency = await getContractCurrency(contractId)
    const fields = buildRowFields(req.body, kind, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_out_boq
        (contract_out_id, sort_order, parent_id, row_kind, item_name, hs_code, unit, quantity,
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type, multiply_qty, hide_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [contractId, refSort + 1, parentId, kind,
        fields.item_name, fields.hs_code, fields.unit, fields.quantity,
        fields.price, fields.before, fields.vat_rate, fields.after, fields.warranty_period, fields.item_type, fields.multiply_qty, fields.hide_amount])

    await promoteParentToGroup(parentId, pool)
    await recomputeTree(contractId)
    invalidateBOQ(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('insertBOQAfter:', err)
    res.status(500).json({ error: 'Failed to insert BOQ item' })
  }
}

// ── PUT /boq/:id ──────────────────────────────────────────────────────────────

export async function updateBOQItem(req, res) {
  try {
    if (await rejectIfStale(req, res, 'public.contract_out_boq')) return
    const { rows: cur } = await pool.query(
      `SELECT b.row_kind, b.multiply_qty, b.contract_out_id, b.parent_id, c.currency_code FROM public.contract_out_boq b
       JOIN public.contract_out c ON c.id = b.contract_out_id
       WHERE b.id = $1`, [req.params.id]
    )
    if (!cur.length) return res.status(404).json({ error: 'Not found' })
    const currency = cur[0].currency_code || 'VND'

    // Tên không trống + không trùng anh-em (cùng parent_id). Sửa không đổi cha → dùng parent_id hiện tại.
    const nameErr = await validateSiblingName({
      contractId: cur[0].contract_out_id, parentId: cur[0].parent_id,
      itemName: req.body.item_name, excludeId: Number(req.params.id),
    })
    if (nameErr) return res.status(400).json({ error: nameErr })
    // row_kind giữ theo DB (không cho đổi qua update để tránh phá cấu trúc cây); nếu client gửi thì tôn trọng.
    const kind = req.body.row_kind ? normKind(req.body.row_kind) : normKind(cur[0].row_kind)
    const fields = buildRowFields(req.body, kind, currency)

    // Dòng thuộc một HỆ THỐNG đã xuất hóa đơn (tổ tiên là nhóm bật multiply_qty đã xuất)
    // → khóa, vì sửa sẽ làm lệch đơn giá hệ thống đã chốt trên hóa đơn.
    if (await ancestorSystemInvoicedQty(req.params.id) > 0) {
      return res.status(400).json({
        error: 'Mặt hàng thuộc hệ thống đã xuất hóa đơn, không thể sửa. Sửa hoặc xóa hóa đơn liên quan trước.',
      })
    }

    // Chỉ dòng lá mới ràng buộc SL theo hóa đơn đã xuất.
    if (kind === KIND.LEAF) {
      const invoiced = await invoicedQty(req.params.id)
      if (fields.quantity < invoiced - 1e-6) {
        return res.status(400).json({
          error: `Không thể giảm số lượng xuống ${fields.quantity}: mặt hàng đã xuất hóa đơn ${invoiced}. Sửa hoặc xóa hóa đơn liên quan trước.`,
        })
      }
    }

    if (kind === KIND.GROUP) {
      // Nhóm đã xuất hóa đơn như 1 hệ thống → không tắt chế độ nhân, không giảm SL dưới mức đã xuất.
      if (cur[0].multiply_qty) {
        const invoiced = await invoicedQty(req.params.id)
        if (invoiced > 0) {
          if (!fields.multiply_qty)
            return res.status(400).json({ error: 'Hệ thống đã xuất hóa đơn, không thể tắt chế độ nhân theo số lượng. Sửa hoặc xóa hóa đơn liên quan trước.' })
          if (fields.quantity < invoiced - 1e-6)
            return res.status(400).json({ error: `Không thể giảm số lượng hệ thống xuống ${fields.quantity}: đã xuất hóa đơn ${invoiced} bộ.` })
        }
      } else if (fields.multiply_qty) {
        // Bật chế độ nhân khi dòng con đã xuất hóa đơn riêng lẻ → sẽ mồ côi các dòng HĐ cũ.
        if (await subtreeInvoicedQty(req.params.id) > 0)
          return res.status(400).json({ error: 'Đã có dòng con xuất hóa đơn riêng lẻ, không thể bật chế độ xuất theo hệ thống. Sửa hoặc xóa hóa đơn liên quan trước.' })
      }
    }

    const { rows } = await pool.query(`
      UPDATE public.contract_out_boq SET
        item_name = $1, hs_code = $2, unit = $3,
        quantity = $4, unit_price = $5,
        amount_before_vat = $6, vat_rate = $7, amount_after_vat = $8,
        warranty_period = $9, item_type = $10, row_kind = $11, multiply_qty = $12,
        hide_amount = $13, updated_at = now()
      WHERE id = $14
      RETURNING *
    `, [fields.item_name, fields.hs_code, fields.unit,
        fields.quantity, fields.price,
        fields.before, fields.vat_rate, fields.after,
        fields.warranty_period, fields.item_type, kind, fields.multiply_qty,
        fields.hide_amount, req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await recomputeTree(rows[0].contract_out_id)
    invalidateBOQ(rows[0].contract_out_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateBOQItem:', err)
    res.status(500).json({ error: 'Failed to update BOQ item' })
  }
}

// ── DELETE /boq/:id ───────────────────────────────────────────────────────────

export async function deleteBOQItem(req, res) {
  try {
    // Không cho xóa nếu node — hoặc bất kỳ dòng con nào của nó — đã có trong hóa đơn đã xuất.
    if (await subtreeInvoicedQty(req.params.id) > 0) {
      return res.status(400).json({ error: 'Không thể xóa: mặt hàng này (hoặc dòng con) đã có trong hóa đơn đã xuất. Sửa hoặc xóa hóa đơn liên quan trước.' })
    }
    // Cũng không cho xóa nếu node nằm trong 1 hệ thống đã xuất hóa đơn (xóa làm lệch đơn giá hệ thống).
    if (await ancestorSystemInvoicedQty(req.params.id) > 0) {
      return res.status(400).json({ error: 'Không thể xóa: mặt hàng thuộc hệ thống đã xuất hóa đơn. Sửa hoặc xóa hóa đơn liên quan trước.' })
    }

    // Xóa node → con cháu tự xóa theo FK ON DELETE CASCADE.
    const { rows } = await pool.query(
      'DELETE FROM public.contract_out_boq WHERE id = $1 RETURNING contract_out_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await recomputeTree(rows[0].contract_out_id)
    invalidateBOQ(rows[0].contract_out_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteBOQItem:', err)
    res.status(500).json({ error: 'Failed to delete BOQ item' })
  }
}

// ── POST /boq/bulk-delete  { ids: [...] } ─ xóa nhiều dòng trong 1 transaction ─

export async function bulkDeleteBOQItems(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Chặn nếu node hoặc BẤT KỲ dòng con nào (xóa cascade) đã xuất hóa đơn.
    const { rows: used } = await client.query(
      `WITH RECURSIVE sub AS (
         SELECT id, item_name FROM public.contract_out_boq WHERE id = ANY($1::bigint[])
         UNION ALL
         SELECT b.id, b.item_name FROM public.contract_out_boq b JOIN sub ON b.parent_id = sub.id
       )
       SELECT DISTINCT sub.item_name FROM public.contract_out_invoice_item it
         JOIN sub ON sub.id = it.boq_id`,
      [ids]
    )
    if (used.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        error: `Không thể xóa, các mặt hàng (hoặc dòng con) đã xuất hóa đơn: ${used.map(r => r.item_name).join(', ')}.`,
      })
    }

    // Chặn xóa dòng nằm trong 1 hệ thống đã xuất hóa đơn (xóa làm lệch đơn giá hệ thống).
    const { rows: inSys } = await client.query(
      `WITH RECURSIVE anc AS (
         SELECT id AS start_id, id, parent_id, row_kind, multiply_qty
           FROM public.contract_out_boq WHERE id = ANY($1::bigint[])
         UNION ALL
         SELECT a.start_id, b.id, b.parent_id, b.row_kind, b.multiply_qty
           FROM public.contract_out_boq b JOIN anc a ON b.id = a.parent_id
       )
       SELECT DISTINCT s.item_name
         FROM anc JOIN public.contract_out_invoice_item it ON it.boq_id = anc.id
         JOIN public.contract_out_boq s ON s.id = anc.start_id
        WHERE anc.id <> anc.start_id AND anc.row_kind = 'group' AND anc.multiply_qty = true`,
      [ids]
    )
    if (inSys.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        error: `Không thể xóa, các mặt hàng thuộc hệ thống đã xuất hóa đơn: ${inSys.map(r => r.item_name).join(', ')}.`,
      })
    }

    const { rows } = await client.query(
      'DELETE FROM public.contract_out_boq WHERE id = ANY($1::bigint[]) RETURNING contract_out_id',
      [ids]
    )
    const contractIds = [...new Set(rows.map(r => r.contract_out_id))]
    for (const cid of contractIds) await recomputeTree(cid, client)
    await client.query('COMMIT')
    for (const cid of contractIds) invalidateBOQ(cid)
    res.json({ message: 'Deleted', count: rows.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('bulkDeleteBOQItems:', err)
    res.status(500).json({ error: 'Failed to delete BOQ items' })
  } finally {
    client.release()
  }
}

// ── POST /contracts/:contractId/boq/reorder ─ đổi thứ tự + (tùy chọn) đổi cha ──
// Nhận một trong hai dạng body:
//   { ids: [...] }                         → chỉ đổi thứ tự (giữ nguyên parent_id)
//   { items: [{ id, parent_id }, ...] }    → đổi thứ tự + gán lại cha (kéo dòng vào phần/nhóm)
// Thứ tự trong mảng = thứ tự hiển thị mới (sort_order = chỉ số + 1).
export async function reorderBOQ(req, res) {
  const { contractId } = req.params

  // Chuẩn hóa thành mảng { id, parent_id }. parent_id === undefined ⇒ không đụng tới cha.
  let items
  if (Array.isArray(req.body?.items)) {
    items = req.body.items
      .map(it => ({
        id: Number(it.id),
        parent_id: it.parent_id == null ? null : Number(it.parent_id),
      }))
      .filter(it => it.id)
  } else {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
    items = ids.map(id => ({ id, parent_id: undefined }))
  }
  if (!items.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let reparented = false
    for (let i = 0; i < items.length; i++) {
      if (items[i].parent_id === undefined) {
        await client.query(
          'UPDATE public.contract_out_boq SET sort_order = $1 WHERE id = $2 AND contract_out_id = $3',
          [i + 1, items[i].id, contractId]
        )
      } else {
        reparented = true
        await client.query(
          'UPDATE public.contract_out_boq SET sort_order = $1, parent_id = $2 WHERE id = $3 AND contract_out_id = $4',
          [i + 1, items[i].parent_id, items[i].id, contractId]
        )
      }
    }

    if (reparented) {
      // Chặn VÒNG LẶP cha-con (kéo một hệ thống vào chính cây con của nó): đi ngược lên
      // cây cha, nếu có nhánh nào không kết thúc trong 60 bước nghĩa là đã thành vòng.
      const { rows: cyc } = await client.query(
        `WITH RECURSIVE anc(start_id, cur, depth) AS (
           SELECT id, parent_id, 1 FROM public.contract_out_boq WHERE contract_out_id = $1
           UNION ALL
           SELECT a.start_id, b.parent_id, a.depth + 1
             FROM anc a JOIN public.contract_out_boq b ON b.id = a.cur AND b.contract_out_id = $1
            WHERE a.cur IS NOT NULL AND a.depth < 60
         )
         SELECT 1 FROM anc WHERE depth >= 60 LIMIT 1`,
        [contractId]
      )
      if (cyc.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Không thể di chuyển: sẽ tạo vòng lặp cha-con trong bảng giá.' })
      }

      // Chặn trùng tên anh-em do kéo dòng vào phần/nhóm đã có dòng cùng tên.
      const targetParents = [...new Set(items.filter(it => it.parent_id !== undefined).map(it => it.parent_id))]
      for (const pid of targetParents) {
        const { rows: dup } = await client.query(
          `SELECT MIN(btrim(item_name)) AS nm FROM public.contract_out_boq
            WHERE contract_out_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND btrim(item_name) <> ''
            GROUP BY lower(regexp_replace(btrim(item_name), '\\s+', ' ', 'g'))
           HAVING COUNT(*) > 1 LIMIT 1`,
          [contractId, pid]
        )
        if (dup.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: `Không thể di chuyển: tên "${dup[0].nm}" sẽ trùng với một dòng khác trong cùng cành.` })
        }
      }

      // Lá vừa nhận con → trở thành nhóm tổng hợp; rồi tính lại roll-up + tổng HĐ.
      await client.query(
        `UPDATE public.contract_out_boq SET row_kind = '${KIND.GROUP}', updated_at = now()
          WHERE contract_out_id = $1 AND row_kind = '${KIND.LEAF}'
            AND id IN (SELECT DISTINCT parent_id FROM public.contract_out_boq
                        WHERE contract_out_id = $1 AND parent_id IS NOT NULL)`,
        [contractId]
      )
      await recomputeTree(contractId, client)
    }

    await client.query('COMMIT')
    invalidateBOQ(contractId)
    res.json({ message: 'Reordered', count: items.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('reorderBOQ:', err)
    res.status(500).json({ error: 'Failed to reorder BOQ' })
  } finally {
    client.release()
  }
}
