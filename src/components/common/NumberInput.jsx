import { useState, useRef, useEffect, useLayoutEffect } from 'react'

// Ô nhập số có phân cách hàng nghìn kiểu Việt Nam (1.234.567,89):
//  - Hiển thị: dấu chấm ngăn hàng nghìn, dấu phẩy ngăn phần thập phân.
//  - Tự chèn phân cách ngay trong lúc gõ, giữ nguyên vị trí con trỏ.
//  - Giá trị trả về qua onChange là chuỗi số "thô" dùng dấu chấm thập phân
//    (vd "1234567.89") để parseFloat/tính toán/backend dùng như cũ.
//
// Dùng cho cột Đơn giá ở bảng giá HĐ mua & bán.

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Số "thô" (vd "15000000.02", 62, "") → chuỗi hiển thị "15.000.000,02".
// integer=true: chỉ hiển thị phần nguyên (bỏ phần thập phân).
function formatFromRaw(v, integer) {
  if (v === '' || v == null) return ''
  let s = String(v)
  let [i, d] = s.split('.')
  i = (i || '').replace(/^0+(?=\d)/, '') || '0'
  return !integer && d != null ? `${groupThousands(i)},${d}` : groupThousands(i)
}

// Chuỗi người dùng gõ → { display, raw }.
// integer=true: bỏ luôn dấu phẩy/phần thập phân, chỉ nhận số nguyên.
function parseTyped(str, integer) {
  if (integer) {
    const intPart = (str.replace(/\D/g, '').replace(/^0+(?=\d)/, '')) || ''
    return { display: groupThousands(intPart), raw: intPart }
  }
  // Chỉ giữ chữ số và dấu phẩy; bỏ mọi dấu chấm (phân cách nghìn) và ký tự khác.
  let cleaned = str.replace(/[^\d,]/g, '')
  // Chỉ giữ dấu phẩy đầu tiên làm phân cách thập phân.
  const c = cleaned.indexOf(',')
  if (c !== -1) cleaned = cleaned.slice(0, c + 1) + cleaned.slice(c + 1).replace(/,/g, '')

  const hasComma = cleaned.includes(',')
  let [intPart, decPart = ''] = cleaned.split(',')
  intPart = intPart.replace(/^0+(?=\d)/, '')
  if (intPart === '' && hasComma) intPart = '0'

  const display = groupThousands(intPart) + (hasComma ? `,${decPart}` : '')
  let raw = intPart
  if (hasComma) raw += `.${decPart}`   // decPart có thể rỗng → "123." (parseFloat vẫn ra 123)
  return { display, raw }
}

// Đếm số ký tự "có nghĩa" (chữ số + dấu phẩy) để khôi phục vị trí con trỏ.
const sigCount = (str) => (str.match(/[\d,]/g) || []).length
function caretAfterSig(formatted, n) {
  if (n <= 0) return 0
  let count = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d,]/.test(formatted[i])) {
      if (++count === n) return i + 1
    }
  }
  return formatted.length
}

export default function NumberInput({ value, onChange, integer = false, ...rest }) {
  const [display, setDisplay] = useState(() => formatFromRaw(value, integer))
  const inputRef = useRef(null)
  const caretRef = useRef(null)
  const lastEmit = useRef(value == null ? '' : String(value))

  // Đồng bộ khi giá trị bị đổi từ bên ngoài (load, lưu xong, làm tròn…),
  // tránh đè lên những gì người dùng đang gõ (so sánh với giá trị vừa phát ra).
  useEffect(() => {
    if (String(value ?? '') !== String(lastEmit.current ?? '')) {
      setDisplay(formatFromRaw(value, integer))
      lastEmit.current = value == null ? '' : String(value)
    }
  }, [value])

  useLayoutEffect(() => {
    if (caretRef.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  }, [display])

  const handleChange = (e) => {
    const sigBefore = sigCount(e.target.value.slice(0, e.target.selectionStart ?? 0))
    const { display: nextDisplay, raw } = parseTyped(e.target.value, integer)
    caretRef.current = caretAfterSig(nextDisplay, sigBefore)
    lastEmit.current = raw
    setDisplay(nextDisplay)
    onChange(raw)
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      style={{ textAlign: 'right', ...(rest.style || {}) }}
    />
  )
}
