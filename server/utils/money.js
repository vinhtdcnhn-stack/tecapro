// Làm tròn số tiền theo đồng tiền của hợp đồng (nguyên tệ):
//  - VND  : làm tròn về số nguyên, KHÔNG lấy phần thập phân.
//  - Ngoại tệ: giữ tối đa 2 chữ số sau dấu phẩy.
// Dùng cho mọi giá trị tiền trước khi lưu DB (đơn giá, thành tiền trước/sau VAT, tổng HĐ).
export function roundMoney(value, currencyCode) {
  const n = parseFloat(value) || 0
  if (!currencyCode || currencyCode === 'VND') return Math.round(n)
  return Math.round(n * 100) / 100
}
