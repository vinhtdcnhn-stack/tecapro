import { useState, useCallback } from 'react'

// Ghi nhớ tùy chỉnh cột của bảng HĐ bán (thứ tự + cột ẩn) theo trình duyệt.
// Chỉ áp cho các cột "movable" (không tính cột dính Quản trị/Số HĐ).
const COLUMN_PREFS_KEY = 'contractList.columns'

// Nạp & hòa giải với danh sách cột hiện có: giữ thứ tự đã lưu, chèn cột mới (thêm
// trong code) vào cuối, bỏ cột không còn tồn tại. Nhờ vậy đổi code cột không vỡ.
function loadPrefs(movableKeys) {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(COLUMN_PREFS_KEY) || '{}') } catch { /* ignore */ }
  const known = new Set(movableKeys)
  const savedOrder = Array.isArray(saved.order) ? saved.order.filter(k => known.has(k)) : []
  const order = savedOrder.concat(movableKeys.filter(k => !savedOrder.includes(k)))
  const hidden = Array.isArray(saved.hidden) ? saved.hidden.filter(k => known.has(k)) : []
  return { order, hidden }
}

function persist(next) {
  try { localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

export function useColumnPrefs(movableKeys) {
  const [prefs, setPrefs] = useState(() => loadPrefs(movableKeys))

  const update = useCallback((fn) => {
    setPrefs(prev => { const next = fn(prev); persist(next); return next })
  }, [])

  // Ẩn/hiện 1 cột
  const toggleColumn = useCallback((key) => {
    update(prev => ({
      ...prev,
      hidden: prev.hidden.includes(key) ? prev.hidden.filter(k => k !== key) : [...prev.hidden, key],
    }))
  }, [update])

  // Chèn cột fromKey vào vị trí của toKey (kéo thả sắp xếp)
  const moveColumn = useCallback((fromKey, toKey) => {
    if (fromKey === toKey) return
    update(prev => {
      const order = [...prev.order]
      const from = order.indexOf(fromKey)
      const to = order.indexOf(toKey)
      if (from < 0 || to < 0) return prev
      order.splice(from, 1)
      order.splice(to, 0, fromKey)
      return { ...prev, order }
    })
  }, [update])

  const resetColumns = useCallback(() => {
    update(() => ({ order: [...movableKeys], hidden: [] }))
  }, [update, movableKeys])

  return { order: prefs.order, hidden: prefs.hidden, toggleColumn, moveColumn, resetColumns }
}
