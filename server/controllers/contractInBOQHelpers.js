import { pool } from '../db.js'
import { roundMoney } from '../utils/money.js'
import { clampMonths, bbIdOrNull } from '../utils/warrantyMonths.js'
import { invalidateContractIn, invalidateContract } from '../services/cacheKeys.js'

// Helper dùng chung cho bảng giá mua (contractInBOQController + contractInBOQExcel).
// Tách ra để giữ mỗi file controller dưới 500 dòng.

// Bảng giá mua đổi → tab boq + (do syncContractInTotal đổi tổng HĐ nhập) danh sách HĐ nhập
// của HĐ bán cha.
export async function invalidateBOQIn(contractInId) {
  if (contractInId == null) return
  invalidateContractIn(contractInId, 'boq')
  try {
    const { rows } = await pool.query('SELECT contract_out_id FROM contract_in WHERE id=$1', [contractInId])
    if (rows[0]) invalidateContract(rows[0].contract_out_id, 'contract-ins')
  } catch { /* bỏ qua */ }
}

// Tính tiền theo đồng tiền HĐ nhập. Làm tròn đơn giá + thành tiền trước/sau VAT:
// VND → số nguyên, ngoại tệ → 2 chữ số lẻ.
export function calc(qty, unitPrice, vatRate, currency) {
  const q = parseFloat(qty) || 0
  const p = roundMoney(unitPrice, currency)
  const v = parseFloat(vatRate) || 0
  const before = roundMoney(q * p, currency)
  const after  = roundMoney(before * (1 + v / 100), currency)
  return { price: p, before, after }
}

// Lấy đồng tiền của HĐ nhập (mặc định VND)
export async function getContractInCurrency(contractInId, db = pool) {
  const { rows } = await db.query(
    'SELECT currency_code FROM contract_in WHERE id = $1', [contractInId]
  )
  return rows[0]?.currency_code || 'VND'
}

// Không cho phép 2 dòng bảng giá mua trùng tên hàng trong cùng 1 HĐ nhập
// (so khớp không phân biệt hoa/thường, đã cắt khoảng trắng). Tên rỗng bỏ qua.
// excludeId: bỏ qua chính dòng đang sửa. Trả về id dòng trùng đầu tiên hoặc null.
export async function findDuplicateName(contractInId, itemName, excludeId = null, db = pool) {
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

export const dupNameError = (name) =>
  `Trùng tên hàng hóa: "${String(name).trim()}" đã tồn tại trong bảng giá mua.`

// Đồng bộ tổng giá trị HĐ nhập = SUM(amount_after_vat) của bảng giá mua (nguyên tệ HĐ).
// Giá trị HĐ nhập do bảng giá quyết định, không nhập tay.
export async function syncContractInTotal(contractInId, db = pool) {
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

// Mốc bảo hành riêng của dòng: biên bản (contract_in_progress của chính HĐ nhập) + số tháng.
// Bỏ trống ⇒ dòng dùng mặc định cấp hợp đồng (contract_in.boq_warranty_*).
export function warrantyFields(body) {
  return {
    warranty_bb_id:  bbIdOrNull(body.warranty_bb_id),
    warranty_months: clampMonths(body.warranty_months),
  }
}

// Biên bản làm mốc bảo hành phải thuộc chính HĐ nhập này (chặn client gửi id lạ).
// Trả chuỗi lỗi nếu sai, null nếu hợp lệ (hoặc không gán mốc).
export async function validateWarrantyBBIn(contractInId, bbId, db = pool) {
  if (bbId == null) return null
  const { rows } = await db.query(
    'SELECT 1 FROM contract_in_progress WHERE id = $1 AND contract_in_id = $2',
    [bbId, contractInId]
  )
  return rows.length ? null : 'Biên bản làm mốc bảo hành không thuộc hợp đồng nhập này.'
}
