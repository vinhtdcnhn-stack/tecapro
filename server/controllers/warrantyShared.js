import { pool } from '../db.js'
import { invalidateContract, invalidateReports } from '../services/cacheKeys.js'

// Nguyên liệu dùng chung của tab Bảo hành, tách khỏi warrantyController.js để giữ
// mỗi file dưới 500 dòng (equipmentController.js dùng lại y hệt).

export const TAB_TTL = 30 * 60 // 30'

// Thiết bị/serial đổi → tab equipment (serial nhúng trong getEquipment) + đợt giao (đếm
// thiết bị) + báo cáo bảo hành.
export function invalidateEquip(contractId) {
  if (contractId == null) return
  invalidateContract(contractId, 'equipment', 'deliveries')
  invalidateReports('warranty')
}
// Case bảo hành đổi → tab warranty-cases + báo cáo bảo hành.
export function invalidateCases(contractId) {
  if (contractId == null) return
  invalidateContract(contractId, 'warranty-cases')
  invalidateReports('warranty')
}
// Nhật ký bảo hành đổi → tab activities + đếm hoạt động ở tab cases.
export function invalidateActs(contractId) {
  if (contractId == null) return
  invalidateContract(contractId, 'warranty-activities', 'warranty-cases')
}

// Tra HĐ bán từ id thiết bị / id case (khi handler chỉ có id con).
export async function contractOfEquipment(equipmentId) {
  const { rows } = await pool.query('SELECT contract_out_id FROM contract_equipment WHERE id=$1', [equipmentId])
  return rows[0]?.contract_out_id
}
export async function contractOfCase(caseId) {
  const { rows } = await pool.query('SELECT contract_out_id FROM warranty_case WHERE id=$1', [caseId])
  return rows[0]?.contract_out_id
}
// Tra danh sách HĐ bán từ nhiều id serial (cho thao tác hàng loạt).
export async function contractsOfSerials(serialIds) {
  if (!serialIds?.length) return []
  const { rows } = await pool.query(
    `SELECT DISTINCT e.contract_out_id FROM equipment_serial s
       JOIN contract_equipment e ON e.id = s.equipment_id WHERE s.id = ANY($1::int[])`, [serialIds])
  return rows.map(r => r.contract_out_id)
}
export async function contractsOfEquipment(equipmentIds) {
  if (!equipmentIds?.length) return []
  const { rows } = await pool.query(
    'SELECT DISTINCT contract_out_id FROM contract_equipment WHERE id = ANY($1::int[])', [equipmentIds])
  return rows.map(r => r.contract_out_id)
}

// Xóa serial KÈM toàn bộ linh kiện con (đệ quy theo parent_serial_id). Không xóa con thì
// FK SET NULL biến chúng thành serial "rời" → cả loại linh kiện hiện thành mục riêng ở tab
// bàn giao. Loại linh kiện bị xóa hết serial (không gắn bảng giá, không có case BH) cũng
// xóa luôn để không còn dòng rỗng. Trả các dòng serial đã xóa { serial_no, equipment_id }.
export async function deleteSerialsWithComponents(db, ids) {
  const { rows } = await db.query(
    `WITH RECURSIVE t AS (
       SELECT id, false AS is_child FROM equipment_serial WHERE id = ANY($1::int[])
       UNION
       SELECT s.id, true FROM equipment_serial s JOIN t ON s.parent_serial_id = t.id)
     DELETE FROM equipment_serial d USING t WHERE d.id = t.id
     RETURNING d.serial_no, d.equipment_id, t.is_child`, [ids])
  const rootEq = new Set(rows.filter(r => !r.is_child).map(r => r.equipment_id))
  const childEq = [...new Set(rows.filter(r => r.is_child).map(r => r.equipment_id))].filter(id => !rootEq.has(id))
  if (childEq.length)
    await db.query(
      `DELETE FROM contract_equipment e WHERE e.id = ANY($1::int[]) AND e.boq_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM equipment_serial s WHERE s.equipment_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM warranty_case_equipment w WHERE w.equipment_id = e.id)`, [childEq])
  return rows
}
