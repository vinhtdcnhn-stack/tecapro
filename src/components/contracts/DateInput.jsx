import { useState, useEffect, useRef } from 'react'
import './DateInput.css'

// Ô nhập ngày luôn hiển thị & nhập theo định dạng VN: dd/mm/yyyy.
// Giá trị vào/ra vẫn là ISO 'yyyy-mm-dd' và onChange phát sự kiện giống <input> gốc
// ({ target: { value } }) nên thay thẳng cho <input type="date"> mà không phải sửa logic.
// Vẫn có lịch chọn ngày (native picker) qua nút 📅.

const pad = (n) => String(n).padStart(2, '0')

// Helper ngày thuần, đặt cạnh component dùng chính (chỉ ảnh hưởng hot-reload dev, không ảnh hưởng build).
// eslint-disable-next-line react-refresh/only-export-components
export function isoToDisplay(iso) {
  if (!iso) return ''
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// 'dd/mm/yyyy' (chấp nhận cả d/m/yyyy hoặc 8 chữ số 'ddmmyyyy') → 'yyyy-mm-dd' | null
// eslint-disable-next-line react-refresh/only-export-components
export function displayToIso(s) {
  if (!s) return ''
  const t = String(s).trim()
  let d, mo, y
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) { d = +slash[1]; mo = +slash[2]; y = +slash[3] }
  else {
    const digits = t.replace(/\D/g, '')
    if (digits.length === 8) { d = +digits.slice(0, 2); mo = +digits.slice(2, 4); y = +digits.slice(4) }
    else return null
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(mo)}-${pad(d)}`
}

export default function DateInput({
  value, onChange, className = '', disabled = false, title,
  placeholder = 'dd/mm/yyyy', style, ...rest
}) {
  const [text, setText] = useState(isoToDisplay(value))
  const hiddenRef = useRef(null)

  useEffect(() => { setText(isoToDisplay(value)) }, [value])

  const emit = (iso) => onChange?.({ target: { value: iso } })

  function handleText(e) {
    const v = e.target.value
    setText(v)
    if (v.trim() === '') { emit(''); return }
    const iso = displayToIso(v)
    if (iso) emit(iso)
  }

  function handleBlur(e) {
    const v = text.trim()
    if (v === '') { emit(''); }
    else {
      const iso = displayToIso(v)
      setText(isoToDisplay(iso || value)) // không hợp lệ → khôi phục giá trị cũ
    }
    rest.onBlur?.(e)
  }

  function openPicker() {
    const el = hiddenRef.current
    if (!el || disabled) return
    if (typeof el.showPicker === 'function') { try { el.showPicker(); return } catch { /* fallback */ } }
    el.focus(); el.click()
  }

  const { onBlur: _omitBlur, ...inputRest } = rest

  return (
    <span className="date-input-wrap" style={style}>
      <input
        type="text" inputMode="numeric"
        className={`${className} date-input-text`.trim()}
        disabled={disabled} title={title} placeholder={placeholder}
        value={text} onChange={handleText} onBlur={handleBlur}
        {...inputRest}
      />
      <button type="button" className="date-input-btn" onClick={openPicker}
        disabled={disabled} tabIndex={-1} aria-label="Chọn ngày">📅</button>
      <input
        ref={hiddenRef} type="date" className="date-input-hidden" tabIndex={-1}
        value={value ? String(value).slice(0, 10) : ''} disabled={disabled}
        onChange={e => emit(e.target.value)} />
    </span>
  )
}
