import { pool } from '../db.js'
import {
  KIND, calc, normKind, recomputeTree, subtreeInvoicedQty, ancestorSystemInvoicedQty,
} from './boqTreeUtils.js'
import { excelUpload, downloadBOQTemplate, parseBOQExcel } from './boqExcel.js'

export { excelUpload, downloadBOQTemplate }

// ── Helpers ──────────────────────────────────────────────────────────────────

// Lấy đồng tiền của HĐ bán (mặc định VND)
async function getContractCurrency(contractId, db = pool) {
  const { rows } = await db.query(
    'SELECT currency_code FROM public.contract_out WHERE id = $1', [contractId]
  )
  return rows[0]?.currency_code || 'VND'
}

// Chuẩn hóa các trường của 1 dòng theo row_kind:
//   leaf  → tính SL × đơn giá như cũ.
//   group → giữ ĐVT/SL mô tả, nhưng đơn giá & số tiền = 0 (recomputeTree sẽ roll-up từ con).
//   zone  → bỏ hết số liệu (chỉ là tiêu đề phân vùng).
function buildRowFields(body, kind, currency) {
  const { item_name, hs_code, unit, quantity, unit_price, vat_rate, warranty_period, item_type } = body
  const type = item_type === 'di_thang' ? 'di_thang' : 'trong_nuoc'
  if (kind === KIND.LEAF) {
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    return {
      item_name: item_name || '', hs_code: hs_code || '', unit: unit || '',
      quantity: parseFloat(quantity) || 0, price, before,
      vat_rate: parseFloat(vat_rate) || 0, after, warranty_period: warranty_period || '', item_type: type,
      multiply_qty: false,
    }
  }
  const isGroup = kind === KIND.GROUP
  return {
    item_name: item_name || '', hs_code: hs_code || '', unit: isGroup ? (unit || '') : '',
    quantity: isGroup ? (parseFloat(quantity) || 0) : 0, price: 0, before: 0,
    vat_rate: 0, after: 0, warranty_period: warranty_period || '', item_type: type,
    multiply_qty: isGroup ? !!body.multiply_qty : false,
  }
}

// Khi thêm con cho một node đang là 'leaf', node đó trở thành nhóm tổng hợp.
async function promoteParentToGroup(parentId, db = pool) {
  if (!parentId) return
  await db.query(
    `UPDATE public.contract_out_boq SET row_kind = '${KIND.GROUP}', updated_at = now()
      WHERE id = $1 AND row_kind = '${KIND.LEAF}'`, [parentId])
}

// Đồng bộ tổng + roll-up cây bảng giá → contract_out. recomputeTree (boqTreeUtils)
// tính lại số tiền cho node nhóm/zone và đặt tổng HĐ = SUM các dòng lá.

// Tổng SL đã xuất hóa đơn của 1 dòng bảng giá (để chặn sửa SL thấp hơn / xóa dòng đã xuất).
async function invoicedQty(boqId, db = pool) {
  const { rows } = await db.query(
    'SELECT COALESCE(SUM(quantity), 0) AS q FROM public.contract_out_invoice_item WHERE boq_id = $1',
    [boqId]
  )
  return parseFloat(rows[0]?.q) || 0
}

// ── GET /contracts/:contractId/boq ────────────────────────────────────────────

export async function getBOQ(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.contract_out_boq WHERE contract_out_id = $1 ORDER BY sort_order, id',
      [req.params.contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getBOQ:', err)
    res.status(500).json({ error: 'Failed to get BOQ' })
  }
}

// ── POST /contracts/:contractId/boq  (append at end) ─────────────────────────

export async function createBOQItem(req, res) {
  try {
    const { contractId } = req.params
    const { parent_id } = req.body
    const kind = normKind(req.body.row_kind)

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
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type, multiply_qty)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [contractId, sortOrder, parent_id || null, kind,
        fields.item_name, fields.hs_code, fields.unit, fields.quantity,
        fields.price, fields.before, fields.vat_rate, fields.after, fields.warranty_period, fields.item_type, fields.multiply_qty])

    await promoteParentToGroup(parent_id, pool)
    await recomputeTree(contractId)
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
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type, multiply_qty)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [contractId, refSort + 1, parentId, kind,
        fields.item_name, fields.hs_code, fields.unit, fields.quantity,
        fields.price, fields.before, fields.vat_rate, fields.after, fields.warranty_period, fields.item_type, fields.multiply_qty])

    await promoteParentToGroup(parentId, pool)
    await recomputeTree(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('insertBOQAfter:', err)
    res.status(500).json({ error: 'Failed to insert BOQ item' })
  }
}

// ── PUT /boq/:id ──────────────────────────────────────────────────────────────

export async function updateBOQItem(req, res) {
  try {
    const { rows: cur } = await pool.query(
      `SELECT b.row_kind, b.multiply_qty, c.currency_code FROM public.contract_out_boq b
       JOIN public.contract_out c ON c.id = b.contract_out_id
       WHERE b.id = $1`, [req.params.id]
    )
    if (!cur.length) return res.status(404).json({ error: 'Not found' })
    const currency = cur[0].currency_code || 'VND'
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
        warranty_period = $9, item_type = $10, row_kind = $11, multiply_qty = $12, updated_at = now()
      WHERE id = $13
      RETURNING *
    `, [fields.item_name, fields.hs_code, fields.unit,
        fields.quantity, fields.price,
        fields.before, fields.vat_rate, fields.after,
        fields.warranty_period, fields.item_type, kind, fields.multiply_qty, req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await recomputeTree(rows[0].contract_out_id)
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
    res.json({ message: 'Reordered', count: items.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('reorderBOQ:', err)
    res.status(500).json({ error: 'Failed to reorder BOQ' })
  } finally {
    client.release()
  }
}

// ── POST /contracts/:contractId/boq/import  (parse Excel → preview) ──────────

export async function importBOQPreview(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const items = parseBOQExcel(req.file.buffer)
    if (!items) return res.status(400).json({ error: 'Không tìm thấy dữ liệu hợp lệ trong file' })
    res.json({ items, total: items.length })
  } catch (err) {
    console.error('importBOQPreview:', err)
    // Không trả err.message thô cho client (có thể lộ chi tiết nội bộ) — log đầy đủ phía server là đủ.
    res.status(500).json({ error: 'Không đọc được file Excel. Kiểm tra lại định dạng file.' })
  }
}

// ── POST /contracts/:contractId/boq/save-import  (confirm & save) ────────────

export async function saveImportedBOQ(req, res) {
  try {
    const { contractId } = req.params
    const { items, replaceAll } = req.body

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Không có dữ liệu để lưu' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (replaceAll) {
        // Thay toàn bộ bảng giá = xóa hết dòng cũ → chặn nếu có dòng đã xuất hóa đơn.
        const { rows: used } = await client.query(
          `SELECT 1 FROM public.contract_out_invoice_item it
             JOIN public.contract_out_boq b ON b.id = it.boq_id
            WHERE b.contract_out_id = $1 LIMIT 1`,
          [contractId]
        )
        if (used.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'Không thể thay toàn bộ bảng giá: đã có mặt hàng xuất hóa đơn. Hãy thêm bổ sung thay vì thay thế.' })
        }
        await client.query('DELETE FROM public.contract_out_boq WHERE contract_out_id = $1', [contractId])
      }

      const currency = await getContractCurrency(contractId, client)

      const { rows: mx } = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_out_boq WHERE contract_out_id = $1',
        [contractId]
      )
      let sortOrder = Number(mx[0].m) + 1

      const saved = []
      const idByIdx = []   // chỉ số item trong mảng → id đã chèn (để map parent_idx → parent_id)
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const kind = normKind(item.row_kind)
        const f = buildRowFields(item, kind, currency)
        const parentId = (item.parent_idx != null && idByIdx[item.parent_idx]) ? idByIdx[item.parent_idx] : null
        const { rows } = await client.query(`
          INSERT INTO public.contract_out_boq
            (contract_out_id, sort_order, parent_id, row_kind, item_name, hs_code, unit, quantity,
             unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type, multiply_qty)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING *
        `, [contractId, sortOrder++, parentId, kind,
            f.item_name, f.hs_code, f.unit, f.quantity,
            f.price, f.before, f.vat_rate, f.after, f.warranty_period, f.item_type, f.multiply_qty])
        idByIdx[i] = rows[0].id
        saved.push(rows[0])
      }

      await recomputeTree(contractId, client)
      await client.query('COMMIT')
      res.json({ saved: saved.length, items: saved })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('saveImportedBOQ:', err)
    res.status(500).json({ error: 'Failed to save imported BOQ' })
  }
}
