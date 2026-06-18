import { useState, useRef, useEffect } from 'react'

// Ô nhập kèm gợi ý: bấm/nhập để xem danh sách lựa chọn đã có, click để chọn,
// hoặc gõ tay giá trị mới. Khác <datalist> ở chỗ luôn hiển thị đủ danh sách
// (datalist tự lọc theo text đang có nên hay chỉ còn 1 dòng). Dùng cho cả PC & mobile.
const menuStyle = {
  position:'absolute', top:'calc(100% + 2px)', left:0, right:0, zIndex:40,
  background:'#fff', border:'1px solid #d1d5db', borderRadius:7,
  boxShadow:'0 8px 24px rgba(0,0,0,.12)', maxHeight:200, overflowY:'auto', padding:4,
}
const optStyle = { padding:'7px 10px', fontSize:13, borderRadius:5, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }

export default function ComboInput({ value, onChange, options = [], placeholder, inputStyle, wrapStyle, autoFocus }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(-1)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = String(value || '').trim().toLowerCase()
  // Đang gõ → lọc theo text; trùng khít đúng 1 lựa chọn → vẫn cho xem cả danh sách để đổi.
  const exactOnly = options.length === 1 && options[0].toLowerCase() === q
  const shown = (q && !exactOnly) ? options.filter(o => o.toLowerCase().includes(q)) : options

  function pick(o) { onChange(o); setOpen(false); setHover(-1) }

  return (
    <div ref={wrapRef} style={{ position:'relative', ...wrapStyle }}>
      <input
        style={inputStyle}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); return }
          if (!open && (e.key === 'ArrowDown')) { setOpen(true); return }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHover(h => Math.min(h + 1, shown.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && open && hover >= 0 && shown[hover]) { e.preventDefault(); pick(shown[hover]) }
        }}
      />
      {open && shown.length > 0 && (
        <div style={menuStyle}>
          {shown.map((o, i) => (
            <div key={o}
              style={{ ...optStyle, background: i === hover ? '#eff6ff' : 'transparent' }}
              onMouseEnter={() => setHover(i)}
              onMouseDown={e => { e.preventDefault(); pick(o) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
