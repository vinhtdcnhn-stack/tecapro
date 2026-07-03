import { pool } from '../db.js'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { roundMoney } from '../utils/money.js'
import { cacheWrap } from '../cache.js'
import { contractInKey, contractInTabNotModified, invalidateContractIn, invalidateContract } from '../services/cacheKeys.js'

const TAB_TTL = 15 * 60 // 15'

// Bảng giá mua đổi → tab boq + (do syncContractInTotal đổi tổng HĐ nhập) danh sách HĐ nhập
// của HĐ bán cha.
async function invalidateBOQIn(contractInId) {
  if (contractInId == null) return
  invalidateContractIn(contractInId, 'boq')
  try {
    const { rows } = await pool.query('SELECT contract_out_id FROM contract_in WHERE id=$1', [contractInId])
    if (rows[0]) invalidateContract(rows[0].contract_out_id, 'contract-ins')
  } catch { /* bỏ qua */ }
}

export const excelUploadIn = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận file .xlsx hoặc .xls'), ok)
  }
})

// Tính tiền theo đồng tiền HĐ nhập. Làm tròn đơn giá + thành tiền trước/sau VAT:
// VND → số nguyên, ngoại tệ → 2 chữ số lẻ.
function calc(qty, unitPrice, vatRate, currency) {
  const q = parseFloat(qty) || 0
  const p = roundMoney(unitPrice, currency)
  const v = parseFloat(vatRate) || 0
  const before = roundMoney(q * p, currency)
  const after  = roundMoney(before * (1 + v / 100), currency)
  return { price: p, before, after }
}

// Lấy đồng tiền của HĐ nhập (mặc định VND)
async function getContractInCurrency(contractInId, db = pool) {
  const { rows } = await db.query(
    'SELECT currency_code FROM contract_in WHERE id = $1', [contractInId]
  )
  return rows[0]?.currency_code || 'VND'
}

// Không cho phép 2 dòng bảng giá mua trùng tên hàng trong cùng 1 HĐ nhập
// (so khớp không phân biệt hoa/thường, đã cắt khoảng trắng). Tên rỗng bỏ qua.
// excludeId: bỏ qua chính dòng đang sửa. Trả về id dòng trùng đầu tiên hoặc null.
async function findDuplicateName(contractInId, itemName, excludeId = null, db = pool) {
  const name = String(itemName ?? '').trim()
  if (!name) return null
  const { rows } = await db.query(
    `SELECT id FROM contract_in_boq
      WHERE contract_in_id = $1
        AND LOWER(TRIM(item_name)) = LOWER($2)
        AND ($3::bigint IS NULL OR id <> $3)
      LIMIT 1`,
    [contractInId, name, excludeId]
  )
  return rows[0]?.id || null
}

const dupNameError = (name) =>
  `Trùng tên hàng hóa: "${String(name).trim()}" đã tồn tại trong bảng giá mua.`

// Đồng bộ tổng giá trị HĐ nhập = SUM(amount_after_vat) của bảng giá mua (nguyên tệ HĐ).
// Giá trị HĐ nhập do bảng giá quyết định, không nhập tay.
async function syncContractInTotal(contractInId, db = pool) {
  if (!contractInId) return
  await db.query(`
    UPDATE contract_in c
    SET amount = COALESCE(t.asum, 0), updated_at = NOW()
    FROM (
      SELECT SUM(amount_after_vat) AS asum FROM contract_in_boq WHERE contract_in_id = $1
    ) t
    WHERE c.id = $1
  `, [contractInId])
}

// Excel columns: A=Danh mục | B=ĐVT | C=Số lượng | D=Đơn giá | E=VAT(%) | F=Thời hạn bảo hành
function rowToItem(arr) {
  const qty     = parseFloat(arr[2]) || 0
  const price   = parseFloat(arr[3]) || 0
  const vatRate = parseFloat(arr[4]) || 0
  const { before, after } = calc(qty, price, vatRate)
  return {
    item_name:        String(arr[0] ?? '').trim(),
    unit:             String(arr[1] ?? '').trim(),
    quantity:         qty,
    unit_price:       price,
    vat_rate:         vatRate,
    amount_before_vat: before,
    amount_after_vat:  after,
    warranty_period:  String(arr[5] ?? '').trim(),
  }
}

// GET /purchase-boq/template
export function downloadPurchaseBOQTemplate(_req, res) {
  const headers = ['Danh mục hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'VAT (%)', 'Thời hạn bảo hành']
  const example = ['UPS Module 50kVA', 'Bộ', 2, 150000000, 10, '24 tháng']
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'BảngGiáMua')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="BangGiaMua_template.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
}

// GET /contract-ins/:contractInId/boq
export async function getPurchaseBOQ(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'boq')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'boq'), TAB_TTL, async () => {
      // Kèm TẤT CẢ ghép "Nhập cho" hiện tại (1 dòng nhập có thể gắn nhiều đầu bán) dưới dạng
      // mảng JSON `links` để cột hiển thị sẵn danh sách.
      const { rows } = await pool.query(
        `SELECT b.*,
                COALESCE(l.links, '[]'::json) AS links
           FROM contract_in_boq b
           LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                      'id', id, 'boq_id', boq_id, 'slot_id', slot_id, 'covered_qty', covered_qty
                    ) ORDER BY id) AS links
               FROM contract_in_boq_supply_link WHERE contract_in_boq_id = b.id
           ) l ON true
          WHERE b.contract_in_id = $1 ORDER BY b.sort_order, b.id`,
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getPurchaseBOQ:', err)
    res.status(500).json({ error: 'Không thể tải bảng giá mua' })
  }
}

// POST /contract-ins/:contractInId/boq
export async function createPurchaseBOQItem(req, res) {
  try {
    const { contractInId } = req.params
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    if (await findDuplicateName(contractInId, item_name)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const currency = await getContractInCurrency(contractInId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM contract_in_boq WHERE contract_in_id = $1',
      [contractInId]
    )
    const sortOrder = Number(mx[0].m) + 1
    const { rows } = await pool.query(`
      INSERT INTO contract_in_boq
        (contract_in_id, sort_order, item_name, unit, quantity, unit_price,
         amount_before_vat, vat_rate, amount_after_vat, warranty_period)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [contractInId, sortOrder, item_name||'', unit||'',
       parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'']
    )
    await syncContractInTotal(contractInId)
    invalidateBOQIn(contractInId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('createPurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể thêm dòng bảng giá' })
  }
}

// POST /contract-ins/:contractInId/boq/after/:refId
export async function insertPurchaseBOQAfter(req, res) {
  try {
    const { contractInId, refId } = req.params
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    if (await findDuplicateName(contractInId, item_name)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const { rows: ref } = await pool.query(
      'SELECT sort_order FROM contract_in_boq WHERE id = $1 AND contract_in_id = $2',
      [refId, contractInId]
    )
    if (!ref.length) return res.status(404).json({ error: 'Reference row not found' })
    const refSort = Number(ref[0].sort_order)
    await pool.query(
      'UPDATE contract_in_boq SET sort_order = sort_order + 1 WHERE contract_in_id = $1 AND sort_order > $2',
      [contractInId, refSort]
    )
    const currency = await getContractInCurrency(contractInId)
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows } = await pool.query(`
      INSERT INTO contract_in_boq
        (contract_in_id, sort_order, item_name, unit, quantity, unit_price,
         amount_before_vat, vat_rate, amount_after_vat, warranty_period)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [contractInId, refSort+1, item_name||'', unit||'',
       parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'']
    )
    await syncContractInTotal(contractInId)
    invalidateBOQIn(contractInId)
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('insertPurchaseBOQAfter:', err)
    res.status(500).json({ error: 'Không thể chèn dòng' })
  }
}

// PUT /purchase-boq/:id
export async function updatePurchaseBOQItem(req, res) {
  try {
    const { item_name, unit, quantity, unit_price, vat_rate, warranty_period } = req.body
    const { rows: cur } = await pool.query(
      `SELECT c.currency_code, b.contract_in_id FROM contract_in_boq b
       JOIN contract_in c ON c.id = b.contract_in_id
       WHERE b.id = $1`, [req.params.id]
    )
    if (!cur.length) return res.status(404).json({ error: 'Not found' })
    if (await findDuplicateName(cur[0].contract_in_id, item_name, req.params.id)) {
      return res.status(409).json({ error: dupNameError(item_name) })
    }
    const currency = cur[0]?.currency_code || 'VND'
    const { price, before, after } = calc(quantity, unit_price, vat_rate, currency)
    const { rows } = await pool.query(`
      UPDATE contract_in_boq SET
        item_name=$1, unit=$2, quantity=$3, unit_price=$4,
        amount_before_vat=$5, vat_rate=$6, amount_after_vat=$7,
        warranty_period=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *`,
      [item_name||'', unit||'', parseFloat(quantity)||0, price,
       before, parseFloat(vat_rate)||0, after, warranty_period||'', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractInTotal(rows[0].contract_in_id)
    invalidateBOQIn(rows[0].contract_in_id)
    res.json(rows[0])
  } catch (err) {
    console.error('updatePurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể cập nhật dòng' })
  }
}

// DELETE /purchase-boq/:id
export async function deletePurchaseBOQItem(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM contract_in_boq WHERE id = $1 RETURNING contract_in_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    await syncContractInTotal(rows[0].contract_in_id)
    invalidateBOQIn(rows[0].contract_in_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deletePurchaseBOQItem:', err)
    res.status(500).json({ error: 'Không thể xóa dòng' })
  }
}

// POST /contract-ins/:contractInId/boq/reorder  { ids: [...] } — đổi thứ tự dòng
export async function reorderPurchaseBOQ(req, res) {
  const { contractInId } = req.params
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        'UPDATE contract_in_boq SET sort_order = $1 WHERE id = $2 AND contract_in_id = $3',
        [i + 1, ids[i], contractInId]
      )
    }
    await client.query('COMMIT')
    invalidateBOQIn(contractInId)
    res.json({ message: 'Reordered', count: ids.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('reorderPurchaseBOQ:', err)
    res.status(500).json({ error: 'Không thể đổi thứ tự dòng' })
  } finally {
    client.release()
  }
}

// POST /purchase-boq/bulk-delete  { ids: [...] } — xóa nhiều dòng trong 1 transaction
export async function bulkDeletePurchaseBOQItems(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'DELETE FROM contract_in_boq WHERE id = ANY($1::bigint[]) RETURNING contract_in_id',
      [ids]
    )
    const contractInIds = [...new Set(rows.map(r => r.contract_in_id))]
    for (const cid of contractInIds) await syncContractInTotal(cid, client)
    await client.query('COMMIT')
    for (const cid of contractInIds) invalidateBOQIn(cid)
    res.json({ message: 'Deleted', count: rows.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('bulkDeletePurchaseBOQItems:', err)
    res.status(500).json({ error: 'Không thể xóa các dòng đã chọn' })
  } finally {
    client.release()
  }
}

// POST /contract-ins/:contractInId/boq/import  (parse Excel → preview)
export async function importPurchaseBOQPreview(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const wb  = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    let startRow = 1
    if (raw.length > 1) {
      const first = raw[1]
      if (isNaN(parseFloat(first[2])) && isNaN(parseFloat(first[3]))) startRow = 2
    }
    const items = []
    for (let i = startRow; i < raw.length; i++) {
      const r = raw[i]
      if (!r[0] && !r[2]) continue
      items.push(rowToItem(r))
    }
    if (!items.length) return res.status(400).json({ error: 'Không tìm thấy dữ liệu hợp lệ' })
    res.json({ items, total: items.length })
  } catch (err) {
    console.error('importPurchaseBOQPreview:', err)
    res.status(500).json({ error: 'Không đọc được file Excel. Kiểm tra lại định dạng file.' })
  }
}

// POST /contract-ins/:contractInId/boq/save-import
export async function saveImportedPurchaseBOQ(req, res) {
  try {
    const { contractInId } = req.params
    const { items, replaceAll } = req.body
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Không có dữ liệu để lưu' })
    }

    // Chặn trùng tên hàng: (1) trong chính file import, (2) với dòng đã có nếu là chế độ nối thêm.
    const seen = new Set()
    for (const item of items) {
      const key = String(item.item_name ?? '').trim().toLowerCase()
      if (!key) continue
      if (seen.has(key)) {
        return res.status(409).json({ error: `Trùng tên hàng hóa trong file: "${String(item.item_name).trim()}".` })
      }
      seen.add(key)
    }
    if (!replaceAll) {
      for (const item of items) {
        if (await findDuplicateName(contractInId, item.item_name)) {
          return res.status(409).json({ error: dupNameError(item.item_name) })
        }
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (replaceAll) {
        await client.query('DELETE FROM contract_in_boq WHERE contract_in_id = $1', [contractInId])
      }
      const currency = await getContractInCurrency(contractInId, client)
      const { rows: mx } = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS m FROM contract_in_boq WHERE contract_in_id = $1',
        [contractInId]
      )
      let sortOrder = Number(mx[0].m) + 1
      const saved = []
      for (const item of items) {
        const { price, before, after } = calc(item.quantity, item.unit_price, item.vat_rate, currency)
        const { rows } = await client.query(`
          INSERT INTO contract_in_boq
            (contract_in_id, sort_order, item_name, unit, quantity, unit_price,
             amount_before_vat, vat_rate, amount_after_vat, warranty_period)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [contractInId, sortOrder++, item.item_name||'', item.unit||'',
           parseFloat(item.quantity)||0, price,
           before, parseFloat(item.vat_rate)||0, after, item.warranty_period||'']
        )
        saved.push(rows[0])
      }
      await syncContractInTotal(contractInId, client)
      await client.query('COMMIT')
      invalidateBOQIn(contractInId)
      res.json({ saved: saved.length, items: saved })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('saveImportedPurchaseBOQ:', err)
    res.status(500).json({ error: 'Không thể lưu bảng giá' })
  }
}
