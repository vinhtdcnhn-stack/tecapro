import { pool } from '../db.js'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { roundMoney } from '../utils/money.js'

// Multer: keep Excel file in memory (no disk write needed)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận file .xlsx hoặc .xls'), ok)
  }
})
export { excelUpload }

// ── Helpers ──────────────────────────────────────────────────────────────────

// Tính tiền theo đồng tiền HĐ. Làm tròn cả đơn giá, thành tiền trước & sau VAT:
// VND → số nguyên, ngoại tệ → 2 chữ số lẻ. Thành tiền sau VAT tính trên thành
// tiền trước VAT đã làm tròn để tổng cộng khớp với từng dòng.
function calc(qty, unitPrice, vatRate, currency) {
  const q = parseFloat(qty) || 0
  const p = roundMoney(unitPrice, currency)
  const v = parseFloat(vatRate) || 0
  const before = roundMoney(q * p, currency)
  const after  = roundMoney(before * (1 + v / 100), currency)
  return { price: p, before, after }
}

// Lấy đồng tiền của HĐ bán (mặc định VND)
async function getContractCurrency(contractId, db = pool) {
  const { rows } = await db.query(
    'SELECT currency_code FROM public.contract_out WHERE id = $1', [contractId]
  )
  return rows[0]?.currency_code || 'VND'
}

// Đồng bộ tổng giá trị BOQ → contract_out (giá trị HĐ lấy từ bảng giá)
async function syncContractTotal(contractId, db = pool) {
  if (!contractId) return
  await db.query(`
    UPDATE public.contract_out c
    SET amount_before_vat = COALESCE(t.bsum, 0),
        amount_after_vat  = COALESCE(t.asum, 0),
        updated_at = now()
    FROM (
      SELECT SUM(amount_before_vat) AS bsum, SUM(amount_after_vat) AS asum
      FROM public.contract_out_boq WHERE contract_out_id = $1
    ) t
    WHERE c.id = $1
  `, [contractId])
}

// Map Excel row (0-indexed array) → BOQ fields
// Expected template columns:
//   A(0): Danh mục hàng hóa | B(1): HScode | C(2): ĐVT
//   D(3): Số lượng | E(4): Đơn giá | F(5): VAT(%) | G(6): Thời hạn bảo hành
function rowToItem(arr) {
  const qty      = parseFloat(arr[3]) || 0
  const price    = parseFloat(arr[4]) || 0
  const vatRate  = parseFloat(arr[5]) || 0
  const { before, after } = calc(qty, price, vatRate)
  return {
    item_name:       String(arr[0] ?? '').trim(),
    hs_code:         String(arr[1] ?? '').trim(),
    unit:            String(arr[2] ?? '').trim(),
    quantity:        qty,
    unit_price:      price,
    vat_rate:        vatRate,
    amount_before_vat: before,
    amount_after_vat:  after,
    warranty_period: String(arr[6] ?? '').trim(),
  }
}

// ── GET /boq/template  (download blank Excel template) ───────────────────────

export function downloadBOQTemplate(_req, res) {
  const headers = [
    'Danh mục hàng hóa',
    'HScode',
    'ĐVT',
    'Số lượng',
    'Đơn giá',
    'VAT (%)',
    'Thời hạn bảo hành',
  ]
  const example = [
    'Camera IP Dome 4MP',
    '8525.80.00',
    'Bộ',
    10,
    5000000,
    8,
    '24 tháng',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, example])

  // Column widths
  ws['!cols'] = [
    { wch: 40 },  // Danh mục
    { wch: 14 },  // HScode
    { wch: 8  },  // ĐVT
    { wch: 10 },  // SL
    { wch: 14 },  // Đơn giá
    { wch: 8  },  // VAT
    { wch: 16 },  // Bảo hành
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'BOQ')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', 'attachment; filename="BOQ_template.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
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
    const { item_name, hs_code, unit, quantity, unit_price, vat_rate, warranty_period, item_type } = req.body

    const currency = await getContractCurrency(contractId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const type = item_type === 'di_thang' ? 'di_thang' : 'trong_nuoc'

    // Next sort_order
    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_out_boq WHERE contract_out_id = $1',
      [contractId]
    )
    const sortOrder = Number(mx[0].m) + 1

    const { rows } = await pool.query(`
      INSERT INTO public.contract_out_boq
        (contract_out_id, sort_order, item_name, hs_code, unit, quantity,
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [contractId, sortOrder,
        item_name || '', hs_code || '', unit || '',
        parseFloat(quantity) || 0, price,
        before, parseFloat(vat_rate) || 0, after, warranty_period || '', type])

    await syncContractTotal(contractId)
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
    const { item_name, hs_code, unit, quantity, unit_price, vat_rate, warranty_period, item_type } = req.body
    const type = item_type === 'di_thang' ? 'di_thang' : 'trong_nuoc'

    // Get sort_order of reference row
    const { rows: ref } = await pool.query(
      'SELECT sort_order FROM public.contract_out_boq WHERE id = $1 AND contract_out_id = $2',
      [refId, contractId]
    )
    if (!ref.length) return res.status(404).json({ error: 'Reference row not found' })

    const refSort = Number(ref[0].sort_order)

    // Shift all rows after the reference row
    await pool.query(
      'UPDATE public.contract_out_boq SET sort_order = sort_order + 1 WHERE contract_out_id = $1 AND sort_order > $2',
      [contractId, refSort]
    )

    const currency = await getContractCurrency(contractId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)

    const { rows } = await pool.query(`
      INSERT INTO public.contract_out_boq
        (contract_out_id, sort_order, item_name, hs_code, unit, quantity,
         unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period, item_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [contractId, refSort + 1,
        item_name || '', hs_code || '', unit || '',
        parseFloat(quantity) || 0, price,
        before, parseFloat(vat_rate) || 0, after, warranty_period || '', type])

    await syncContractTotal(contractId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('insertBOQAfter:', err)
    res.status(500).json({ error: 'Failed to insert BOQ item' })
  }
}

// ── PUT /boq/:id ──────────────────────────────────────────────────────────────

export async function updateBOQItem(req, res) {
  try {
    const { item_name, hs_code, unit, quantity, unit_price, vat_rate, warranty_period, item_type } = req.body

    const { rows: cur } = await pool.query(
      `SELECT c.currency_code FROM public.contract_out_boq b
       JOIN public.contract_out c ON c.id = b.contract_out_id
       WHERE b.id = $1`, [req.params.id]
    )
    const currency = cur[0]?.currency_code || 'VND'
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const type = item_type === 'di_thang' ? 'di_thang' : 'trong_nuoc'

    const { rows } = await pool.query(`
      UPDATE public.contract_out_boq SET
        item_name = $1, hs_code = $2, unit = $3,
        quantity = $4, unit_price = $5,
        amount_before_vat = $6, vat_rate = $7, amount_after_vat = $8,
        warranty_period = $9, item_type = $10, updated_at = now()
      WHERE id = $11
      RETURNING *
    `, [item_name || '', hs_code || '', unit || '',
        parseFloat(quantity) || 0, price,
        before, parseFloat(vat_rate) || 0, after,
        warranty_period || '', type, req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractTotal(rows[0].contract_out_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updateBOQItem:', err)
    res.status(500).json({ error: 'Failed to update BOQ item' })
  }
}

// ── DELETE /boq/:id ───────────────────────────────────────────────────────────

export async function deleteBOQItem(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_out_boq WHERE id = $1 RETURNING contract_out_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractTotal(rows[0].contract_out_id)
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
    const { rows } = await client.query(
      'DELETE FROM public.contract_out_boq WHERE id = ANY($1::bigint[]) RETURNING contract_out_id',
      [ids]
    )
    const contractIds = [...new Set(rows.map(r => r.contract_out_id))]
    for (const cid of contractIds) await syncContractTotal(cid, client)
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

// ── POST /contracts/:contractId/boq/reorder  { ids: [...] } ─ đổi thứ tự dòng ─

export async function reorderBOQ(req, res) {
  const { contractId } = req.params
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        'UPDATE public.contract_out_boq SET sort_order = $1 WHERE id = $2 AND contract_out_id = $3',
        [i + 1, ids[i], contractId]
      )
    }
    await client.query('COMMIT')
    res.json({ message: 'Reordered', count: ids.length })
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

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Skip header row(s): find first row where col D or E looks numeric
    let startRow = 1
    if (raw.length > 1) {
      // If the first data row has no numeric quantity/price, skip it (header)
      const first = raw[1]
      if (isNaN(parseFloat(first[3])) && isNaN(parseFloat(first[4]))) startRow = 2
    }

    const items = []
    for (let i = startRow; i < raw.length; i++) {
      const r = raw[i]
      if (!r[0] && !r[1] && !r[3]) continue  // skip blank rows
      items.push(rowToItem(r))
    }

    if (!items.length) return res.status(400).json({ error: 'Không tìm thấy dữ liệu hợp lệ trong file' })
    res.json({ items, total: items.length })
  } catch (err) {
    console.error('importBOQPreview:', err)
    res.status(500).json({ error: 'Lỗi đọc file Excel: ' + err.message })
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
        await client.query('DELETE FROM public.contract_out_boq WHERE contract_out_id = $1', [contractId])
      }

      const currency = await getContractCurrency(contractId, client)

      const { rows: mx } = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_out_boq WHERE contract_out_id = $1',
        [contractId]
      )
      let sortOrder = Number(mx[0].m) + 1

      const saved = []
      for (const item of items) {
        const { price, before, after } = calc(item.quantity, item.unit_price, item.vat_rate, currency)
        const { rows } = await client.query(`
          INSERT INTO public.contract_out_boq
            (contract_out_id, sort_order, item_name, hs_code, unit, quantity,
             unit_price, amount_before_vat, vat_rate, amount_after_vat, warranty_period)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING *
        `, [contractId, sortOrder++,
            item.item_name || '', item.hs_code || '', item.unit || '',
            parseFloat(item.quantity) || 0, price,
            before, parseFloat(item.vat_rate) || 0, after, item.warranty_period || ''])
        saved.push(rows[0])
      }

      await syncContractTotal(contractId, client)
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
