import multer from 'multer'

// Tiện ích & mảnh SQL dùng chung cho các controller đợt nhận hàng (batch / item / serial).

export const norm = (s) => String(s ?? '').trim().toLowerCase()

// Một chủng loại chỉ giữ serial THÀNH PHẦN (mọi serial đều có parent_serial_id) là
// "linh kiện của máy" — nó vẫn nằm trong tab quản lý serial, nhưng KHÔNG hiện thành
// dòng riêng ở đợt nhận hàng. Hiển thị ở đợt nhận khi: chưa có serial nào, HOẶC có ít
// nhất 1 serial độc lập (máy). Đây thuần là lọc HIỂN THỊ, không đổi dữ liệu.
const VISIBLE_ITEM = `(
  EXISTS (SELECT 1 FROM contract_in_delivery_serial s WHERE s.delivery_item_id = di.id AND s.parent_serial_id IS NULL)
  OR NOT EXISTS (SELECT 1 FROM contract_in_delivery_serial s WHERE s.delivery_item_id = di.id)
)`

// Chủng loại có TRONG BẢNG GIÁ MUA (contract_in_boq) của hợp đồng: hoặc đã liên kết
// trực tiếp qua boq_item_id, hoặc trùng tên (không phân biệt hoa/thường) với 1 dòng BOQ.
const IN_BOQ = `(
  di.boq_item_id IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM contract_in_boq b
    JOIN contract_in_delivery d2 ON d2.contract_in_id = b.contract_in_id
    WHERE d2.id = di.delivery_id
      AND lower(btrim(b.item_name)) = lower(btrim(di.item_name))
  )
)`

// Hợp đồng (chứa đợt của di) có khai BẢNG GIÁ MUA hay chưa.
const CONTRACT_HAS_BOQ = `EXISTS (
  SELECT 1 FROM contract_in_boq b
  JOIN contract_in_delivery d3 ON d3.contract_in_id = b.contract_in_id
  WHERE d3.id = di.delivery_id
)`

// Lọc HIỂN THỊ ở tab Nhận hàng: chỉ hiện chủng loại có trong bảng giá mua. Nếu hợp đồng
// CHƯA khai bảng giá mua thì quay lại quy tắc cũ (VISIBLE_ITEM) để không làm trống tab.
export const SHOW_ITEM = `(
  ${IN_BOQ}
  OR (NOT ${CONTRACT_HAS_BOQ} AND ${VISIBLE_ITEM})
)`

export const excelUploadDelivery = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(ok ? null : new Error('Chỉ chấp nhận .xlsx/.xls'), ok)
  }
})
