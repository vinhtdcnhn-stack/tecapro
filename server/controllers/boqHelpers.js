import { pool } from '../db.js'
import { KIND, calc } from './boqTreeUtils.js'

// Helpers dùng chung cho bảng giá HĐ bán (boqController + boqImportController).
// Tách ra để giữ mỗi file controller dưới 500 dòng.

// Lấy đồng tiền của HĐ bán (mặc định VND)
export async function getContractCurrency(contractId, db = pool) {
  const { rows } = await db.query(
    'SELECT currency_code FROM public.contract_out WHERE id = $1', [contractId]
  )
  return rows[0]?.currency_code || 'VND'
}

// Chuẩn hóa các trường của 1 dòng theo row_kind:
//   leaf  → tính SL × đơn giá như cũ.
//   group → giữ ĐVT/SL mô tả, nhưng đơn giá & số tiền = 0 (recomputeTree sẽ roll-up từ con).
//   zone  → bỏ hết số liệu (chỉ là tiêu đề phân vùng).
export function buildRowFields(body, kind, currency) {
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
export async function promoteParentToGroup(parentId, db = pool) {
  if (!parentId) return
  await db.query(
    `UPDATE public.contract_out_boq SET row_kind = '${KIND.GROUP}', updated_at = now()
      WHERE id = $1 AND row_kind = '${KIND.LEAF}'`, [parentId])
}

// Tổng SL đã xuất hóa đơn của 1 dòng bảng giá (để chặn sửa SL thấp hơn / xóa dòng đã xuất).
export async function invoicedQty(boqId, db = pool) {
  const { rows } = await db.query(
    'SELECT COALESCE(SUM(quantity), 0) AS q FROM public.contract_out_invoice_item WHERE boq_id = $1',
    [boqId]
  )
  return parseFloat(rows[0]?.q) || 0
}

// Chuẩn hóa tên để so trùng: bỏ hoa-thường + gộp khoảng trắng (cắt 2 đầu, gộp khoảng giữa).
export function normName(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Kiểm tra tên dòng bảng giá: không được trống và không trùng anh-em (cùng parent_id) trong HĐ.
// So khớp bỏ hoa-thường + khoảng trắng. Trả chuỗi lỗi nếu vi phạm, null nếu hợp lệ.
export async function validateSiblingName({ contractId, parentId, itemName, excludeId = null }, db = pool) {
  const norm = normName(itemName)
  if (!norm) return 'Tên không được để trống.'
  const { rows } = await db.query(
    `SELECT 1 FROM public.contract_out_boq
       WHERE contract_out_id = $1
         AND parent_id IS NOT DISTINCT FROM $2
         AND lower(regexp_replace(btrim(item_name), '\\s+', ' ', 'g')) = $3
         AND ($4::bigint IS NULL OR id <> $4)
       LIMIT 1`,
    [contractId, parentId ?? null, norm, excludeId]
  )
  return rows.length ? `Tên "${String(itemName).trim()}" đã tồn tại trong cùng cành (cùng cấp). Vui lòng dùng tên khác.` : null
}
