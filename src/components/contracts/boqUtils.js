// Định dạng tiền theo đồng tiền HĐ:
//  - VND: làm tròn về số nguyên, KHÔNG hiển thị thập phân.
//  - Ngoại tệ: giữ tối đa 2 chữ số thập phân (chỉ hiện khi thực sự có lẻ).
// Làm tròn trước khi xét phần lẻ để tránh sai số dấu phẩy động (vd 4117740000.0000001 → ,00).
export const fmtNum = (n, currency = 'VND') => {
  let num = parseFloat(n) || 0
  if (currency === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(num))
  num = Math.round(num * 100) / 100
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num)
}

// Bỏ đuôi số 0 thừa khi hiển thị trong ô nhập (vd "62.0000" → "62", "1234.50" → "1234.5").
export const stripNum = (v) => (v === '' || v == null) ? '' : String(Number(v))

// Làm tròn tiền theo đồng tiền HĐ: VND → số nguyên; ngoại tệ → 2 chữ số lẻ.
export const roundMoney = (v, currency = 'VND') => {
  const n = parseFloat(v) || 0
  return currency === 'VND' ? Math.round(n) : Math.round(n * 100) / 100
}

// Tính tiền HĐ, làm tròn theo đồng tiền để khớp đúng giá trị lưu DB.
export function calcAmounts(qty, price, vat, currency = 'VND') {
  const q = parseFloat(qty) || 0
  const p = roundMoney(price, currency)
  const v = parseFloat(vat) || 0
  const before = roundMoney(q * p, currency)
  const after  = roundMoney(before * (1 + v / 100), currency)
  return { before, after }
}

let _tmpCounter = 0
export const tmpId = () => `tmp_${++_tmpCounter}`
