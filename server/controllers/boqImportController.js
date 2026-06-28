import { pool } from '../db.js'
import { normKind, recomputeTree } from './boqTreeUtils.js'
import { parseBOQExcel } from './boqExcel.js'
import { getContractCurrency, buildRowFields, validateSiblingName } from './boqHelpers.js'
import { invalidateBOQ } from './boqController.js'

// Import Excel cho bảng giá HĐ bán (preview + lưu). Tách khỏi boqController.js để giữ file dưới 500 dòng.

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

        // Chặn trùng tên anh-em (so cả với dòng đã chèn trước trong batch nhờ cùng transaction).
        const nameErr = await validateSiblingName({ contractId, parentId, itemName: f.item_name }, client)
        if (nameErr) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: `Dòng ${i + 1}: ${nameErr}` })
        }

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
      invalidateBOQ(contractId)
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
