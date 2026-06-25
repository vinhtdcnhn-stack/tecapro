import multer from 'multer'
import * as XLSX from 'xlsx'
import { KIND, calc, classifyExcelKind, linkHierarchy } from './boqTreeUtils.js'

// Nhập / xuất Excel cho bảng giá HĐ bán. Tách khỏi boqController.js để giữ file dưới 500 dòng.

// Multer: giữ file Excel trong bộ nhớ (không ghi đĩa)
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận file .xlsx hoặc .xls'), ok)
  },
})

// Map Excel row (0-indexed array) → BOQ fields. Vai trò (zone/group/leaf) suy ra từ
// dữ liệu cột (classifyExcelKind): trống ĐVT+SL = zone; trống đơn giá = nhóm; có đơn giá = lá.
// Cột template: A(0) Danh mục | B(1) HScode | C(2) ĐVT | D(3) SL | E(4) Đơn giá | F(5) VAT | G(6) Bảo hành
function rowToItem(arr) {
  const kind = classifyExcelKind(arr)
  const isLeaf  = kind === KIND.LEAF
  const isGroup = kind === KIND.GROUP
  const qty     = isLeaf || isGroup ? (parseFloat(arr[3]) || 0) : 0   // zone không SL
  const price   = isLeaf ? (parseFloat(arr[4]) || 0) : 0
  const vatRate = isLeaf ? (parseFloat(arr[5]) || 0) : 0
  const { before, after } = isLeaf ? calc(qty, price, vatRate) : { before: 0, after: 0 }
  return {
    row_kind:        kind,
    item_name:       String(arr[0] ?? '').trim(),
    hs_code:         String(arr[1] ?? '').trim(),
    unit:            isLeaf || isGroup ? String(arr[2] ?? '').trim() : '',
    quantity:        qty,
    unit_price:      price,
    vat_rate:        vatRate,
    amount_before_vat: before,
    amount_after_vat:  after,
    warranty_period: String(arr[6] ?? '').trim(),
  }
}

// Đọc buffer Excel → mảng item đã gán cha-con theo tầng. Trả null nếu không có dữ liệu.
export function parseBOQExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Bỏ dòng tiêu đề: nếu dòng dữ liệu đầu không có SL/đơn giá dạng số thì coi là header.
  let startRow = 1
  if (raw.length > 1) {
    const first = raw[1]
    if (isNaN(parseFloat(first[3])) && isNaN(parseFloat(first[4]))) startRow = 2
  }

  const items = []
  for (let i = startRow; i < raw.length; i++) {
    const r = raw[i]
    if (!String(r[0] ?? '').trim()) continue  // bỏ dòng không có tên
    items.push(rowToItem(r))
  }
  if (!items.length) return null
  return linkHierarchy(items)   // gán parent_idx theo tầng (zone → group → leaf)
}

// GET /boq/template — tải file Excel mẫu (kèm ví dụ minh họa phân cấp).
export function downloadBOQTemplate(_req, res) {
  const headers = [
    'Danh mục hàng hóa', 'HScode', 'ĐVT', 'Số lượng', 'Đơn giá', 'VAT (%)', 'Thời hạn bảo hành',
  ]
  // Dòng trống ĐVT+SL = Zone (Phần); có ĐVT/SL nhưng trống Đơn giá = nhóm tổng hợp;
  // có Đơn giá = dòng có giá (lá). Để trống các ô tương ứng.
  const examples = [
    ['Phần 1: UPS 600kVA cho phân khu 1', '', '', '', '', '', ''],                  // zone
    ['Hệ thống UPS 600kVA, bao gồm:', '', 'Hệ thống', 12, '', '', ''],              // group
    ['Liebert APM2 600kVA/600kW', '8504.40.90', 'Bộ', 12, 825327000, 8, '24 tháng'], // leaf
    ['Battery system (4 rack/system)', '', 'Bộ', 12, 1203684000, 8, '24 tháng'],     // leaf
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'BOQ')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', 'attachment; filename="BOQ_template.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
}
