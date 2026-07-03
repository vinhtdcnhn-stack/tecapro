import { useEffect, useRef, useState } from 'react'

// Panel "⚙ Cột": tick ẩn/hiện + kéo thả sắp xếp thứ tự cột. Đóng khi bấm ra ngoài.
// columns: mảng cột movable đã theo thứ tự hiện tại (chỉ gồm cột user được phép xem).
export default function ColumnSettingsPanel({ columns, hidden, onToggle, onMove, onReset, onClose }) {
  const wrapRef = useRef(null)
  const dragKey = useRef(null)
  const [overKey, setOverKey] = useState(null)

  useEffect(() => {
    function handleClickOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div ref={wrapRef} className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Hiển thị cột</span>
        <button onClick={onReset} className="text-xs text-tecapro-600 hover:text-tecapro-700 font-medium">Mặc định</button>
      </div>
      <p className="px-2 pb-1 text-[11px] text-gray-400">Kéo ⠿ để đổi thứ tự, bỏ tick để ẩn cột.</p>
      <div className="max-h-72 overflow-y-auto">
        {columns.map(col => (
          <label
            key={col.key}
            draggable
            onDragStart={() => { dragKey.current = col.key }}
            onDragOver={(e) => { e.preventDefault(); if (overKey !== col.key) setOverKey(col.key) }}
            onDragLeave={() => setOverKey(prev => (prev === col.key ? null : prev))}
            onDrop={() => { if (dragKey.current) onMove(dragKey.current, col.key); dragKey.current = null; setOverKey(null) }}
            onDragEnd={() => { dragKey.current = null; setOverKey(null) }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab select-none hover:bg-gray-50 ${overKey === col.key ? 'border-t-2 border-tecapro-400' : 'border-t-2 border-transparent'}`}
          >
            <span className="text-gray-300" aria-hidden>⠿</span>
            <input
              type="checkbox"
              checked={!hidden.includes(col.key)}
              onChange={() => onToggle(col.key)}
              className="rounded border-gray-300 text-tecapro-600 focus:ring-tecapro-500"
            />
            <span className="text-sm text-gray-700">{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
