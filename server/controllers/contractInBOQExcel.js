import { pool } from '../db.js'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { parseWarrantyMonths } from '../utils/warrantyMonths.js'
import {
  calc, getContractInCurrency, findDuplicateName, dupNameError,
  syncContractInTotal, invalidateBOQIn,
} from './contractInBOQHelpers.js'

// Nhập / xuất Excel cho bảng giá mua (HĐ nhập). Tách khỏi contractInBOQController.js
// để giữ mỗi file dưới 500 dòng.

export const excelUploadIn = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận file .xlsx hoặc .xls'), ok)
  }
})

// Excel columns: A=Danh mục | B=ĐVT | C=Số lượng | D=Đơn giá | E=VAT(%) | F=Thời hạn bảo hành
function rowToItem(arr) {
  const qty     = parseFloat(arr[2]) || 0
  const price   = parseFloat(arr[3]) || 0
  const vatRate = parseFloat(arr[4]) || 0
  const { before, after } = calc(qty, price, vatRate)
  const warranty = String(arr[5] ?? '').trim()
  return {
    item_name:        String(arr[0] ?? '').trim(),
    unit:             String(arr[1] ?? '').trim(),
    quantity:         qty,
    unit_price:       price,
    vat_rate:         vatRate,
    amount_before_vat: before,
    amount_after_vat:  after,
    warranty_period:  warranty,
    // Đọc luôn số tháng ra từ chữ ("36 tháng" → 36) để dòng nhập từ Excel cũng tính
    // được ngày hết hạn khi gán mốc biên bản. Mốc biên bản vẫn phải chọn trong app.
    warranty_months:  parseWarrantyMonths(warranty),
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
             amount_before_vat, vat_rate, amount_after_vat, warranty_period, warranty_months)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [contractInId, sortOrder++, item.item_name||'', item.unit||'',
           parseFloat(item.quantity)||0, price,
           before, parseFloat(item.vat_rate)||0, after, item.warranty_period||'',
           item.warranty_months ?? null]
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
