// Gắn định danh "dòng nào" cho lịch sử thay đổi (Ctrl+Shift+H của admin).
//
// Spread {...auditRowAttrs('contract_out_boq', row.id)} lên phần tử dòng (<tr> ở desktop,
// container card ở mobile). RowAuditViewer đọc data-audit-table + data-audit-id của phần
// tử đang nằm dưới con trỏ chuột để tra lịch sử đúng dòng đó.
//
// LƯU Ý: id phải là id THẬT trong DB (row.id), KHÔNG phải khóa client (_key). Bảng phải
// nằm trong whitelist AUDITED_TABLES ở server/controllers/auditController.js.
export function auditRowAttrs(tableName, id) {
  if (!tableName || id === null || id === undefined || id === '') return {}
  return { 'data-audit-table': tableName, 'data-audit-id': String(id) }
}
