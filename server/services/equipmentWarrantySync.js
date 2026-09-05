import { pool } from '../db.js'
import { hasContractPerm } from '../middleware/guardUtils.js'
import { invalidateContract, invalidateReports, invalidateSerialLookup } from './cacheKeys.js'

// Đồng bộ THIẾT BỊ BÀN GIAO ← DÒNG BẢNG GIÁ (xem migration 107).
//
// Thiết bị có boq_id thì tên + mốc bảo hành luôn suy ra từ bảng giá:
//   name            = contract_out_boq.item_name
//   warranty_bb_id  = dòng ?? mặc định cấp HĐ (contract_out.boq_warranty_bb_id)
//   warranty_months = dòng ?? mặc định cấp HĐ (contract_out.boq_warranty_months)
//   warranty_from   = ngày THỰC TẾ của biên bản mốc
//   warranty_to     = warranty_from + số tháng (Postgres tự kẹp cuối tháng, giống addMonths ở FE)
//
// Gọi lại hàm này sau MỌI thay đổi có thể làm lệch: sửa dòng bảng giá, đổi mốc mặc định,
// nhập lại bảng giá từ Excel, đổi ngày thực tế của biên bản, và khi lưu chính thiết bị.

// Mốc bảo hành HIỆU LỰC của 1 dòng bảng giá (đã áp mặc định cấp HĐ) + ngày biên bản.
// Trả null nếu dòng không thuộc hợp đồng này hoặc không phải dòng lá.
export async function effectiveBOQWarranty(contractId, boqId, db = pool) {
  const { rows } = await db.query(
    `SELECT b.id, b.item_name, b.row_kind,
            COALESCE(b.warranty_bb_id, c.boq_warranty_bb_id)   AS bb_id,
            COALESCE(b.warranty_months, c.boq_warranty_months) AS months,
            p.actual_date AS from_date
       FROM public.contract_out_boq b
       JOIN public.contract_out c ON c.id = b.contract_out_id
       LEFT JOIN public.contract_out_progress p
              ON p.id = COALESCE(b.warranty_bb_id, c.boq_warranty_bb_id)
      WHERE b.id = $1 AND b.contract_out_id = $2`,
    [boqId, contractId],
  )
  return rows[0] || null
}

// Ghi lại tên + mốc bảo hành cho MỌI thiết bị của hợp đồng đang gắn dòng bảng giá.
// Chỉ đụng dòng thực sự lệch (IS DISTINCT FROM) để không tạo bản ghi nhật ký thay đổi thừa.
// Trả số thiết bị đã cập nhật.
export async function syncEquipmentFromBOQ(contractId, db = pool) {
  if (contractId == null) return 0
  const { rows } = await db.query(
    `WITH src AS (
       SELECT b.id AS boq_id, b.item_name,
              COALESCE(b.warranty_bb_id, c.boq_warranty_bb_id)   AS bb_id,
              COALESCE(b.warranty_months, c.boq_warranty_months) AS months,
              p.actual_date AS from_date
         FROM public.contract_out_boq b
         JOIN public.contract_out c ON c.id = b.contract_out_id
         LEFT JOIN public.contract_out_progress p
                ON p.id = COALESCE(b.warranty_bb_id, c.boq_warranty_bb_id)
        WHERE b.contract_out_id = $1
     )
     UPDATE public.contract_equipment e
        SET name            = s.item_name,
            warranty_bb_id  = s.bb_id,
            warranty_months = s.months,
            warranty_from   = s.from_date,
            warranty_to     = CASE WHEN s.from_date IS NOT NULL AND s.months IS NOT NULL
                                   THEN (s.from_date + (s.months || ' months')::interval)::date END,
            updated_at      = NOW()
       FROM src s
      WHERE e.boq_id = s.boq_id
        AND e.contract_out_id = $1
        AND (e.name            IS DISTINCT FROM s.item_name
          OR e.warranty_bb_id  IS DISTINCT FROM s.bb_id
          OR e.warranty_months IS DISTINCT FROM s.months
          OR e.warranty_from   IS DISTINCT FROM s.from_date)
      RETURNING e.id`,
    [contractId],
  )
  if (rows.length) {
    invalidateContract(contractId, 'equipment', 'deliveries')
    invalidateReports('warranty')
    // Hạn BH đổi → kết quả trang "Tra cứu bảo hành" của các serial thuộc thiết bị đó cũng đổi.
    const { rows: ser } = await db.query(
      'SELECT serial_no FROM equipment_serial WHERE equipment_id = ANY($1::int[])',
      [rows.map(r => r.id)],
    )
    invalidateSerialLookup(ser.map(s => s.serial_no))
  }
  return rows.length
}

// Bọc syncEquipmentFromBOQ cho các chỗ gọi "bắn rồi quên" (sau khi đã trả response):
// lỗi đồng bộ không được làm hỏng thao tác chính.
export function syncEquipmentFromBOQSafe(contractId) {
  syncEquipmentFromBOQ(contractId).catch(err =>
    console.error('syncEquipmentFromBOQ:', err))
}

// Được phép GHI NGƯỢC mốc bảo hành vào bảng giá không?
// Trả chuỗi lý do nếu KHÔNG được (bảng giá đang khóa / thiếu quyền co.boq.manage), null nếu được.
export async function boqWriteBlockReason(user, contractId, db = pool) {
  const { rows } = await db.query(
    'SELECT boq_locked FROM public.contract_out WHERE id = $1', [contractId])
  if (!rows[0]) return 'Không tìm thấy hợp đồng.'
  if (rows[0].boq_locked) {
    return 'Bảng giá đang khóa nên không sửa được mốc bảo hành. Mở khóa bảng giá trước.'
  }
  const ok = await hasContractPerm(user, contractId, 'co.boq.manage')
  return ok ? null : 'Bạn không có quyền sửa bảng giá (co.boq.manage) nên không đổi được mốc bảo hành ở đây.'
}

// Ghi mốc bảo hành vào ĐÚNG DÒNG bảng giá (điền riêng cho dòng, không đụng mặc định cấp HĐ).
export async function writeWarrantyToBOQ(boqId, { bbId, months }, db = pool) {
  await db.query(
    `UPDATE public.contract_out_boq
        SET warranty_bb_id = $1, warranty_months = $2, updated_at = now()
      WHERE id = $3`,
    [bbId, months, boqId],
  )
}
