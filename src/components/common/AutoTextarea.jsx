import { useRef, useLayoutEffect } from 'react'

// Ô nhập nhiều dòng tự giãn chiều cao theo nội dung (trông như <input> khi 1 dòng,
// tự xuống dòng + cao thêm khi văn bản dài). Dùng cho các ô tên dài như "Tên hàng hóa".
export default function AutoTextarea({ value, onChange, className, ...rest }) {
  const ref = useRef(null)

  const resize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useLayoutEffect(() => { resize(ref.current) }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={className}
      onChange={e => { onChange(e); resize(e.target) }}
      {...rest}
    />
  )
}
