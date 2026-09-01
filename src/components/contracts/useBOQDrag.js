import { useState } from 'react'
import { subtreeKeySet } from './boqTree'
import { API } from '../../config/api'

// Kéo-thả sắp xếp lại bảng giá HĐ bán (cây phân cấp Phần → Hệ thống → Dòng).
// Tách khỏi useBOQTab.js để giữ mỗi file dưới 500 dòng.
//
// Chỉ cho phép kéo dòng ĐÃ LƯU và khi KHÔNG lọc (thứ tự hiển thị == thứ tự gốc) —
// điều kiện đó do component quyết định qua prop canDrag của từng dòng.
export default function useBOQDrag({ contractId, rows, setRows, load }) {
  const [dragKey, setDragKey]         = useState(null)   // _key của dòng đang kéo
  const [dragOverKey, setDragOverKey] = useState(null)
  // Thả lên PHẦN/HỆ THỐNG: nửa TRÊN = chèn trước nó (cùng cấp), nửa DƯỚI = gom vào làm con.
  // Nhờ nửa trên mà một hệ thống đang nằm trong hệ thống khác vẫn kéo ra ngoài được.
  const [dragOverMode, setDragOverMode] = useState('into')

  // Gửi cả parent_id để server vừa đổi thứ tự vừa gán lại cha (kéo dòng vào phần/nhóm).
  const persistOrder = async (orderedRows) => {
    const items = orderedRows
      .filter(r => !r._isNew && r.id)
      .map(r => ({ id: r.id, parent_id: r.parent_id ?? null }))
    if (!items.length) return
    try {
      const res = await fetch(`${API}/contracts/${contractId}/boq/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        // VD: kéo dòng vào nhóm đã có tên trùng → server từ chối, khôi phục lại cấu trúc cũ.
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Không thể sắp xếp lại bảng giá.')
        load()
      }
    } catch (e) {
      console.error('reorder BOQ:', e)
      load()  // khôi phục thứ tự + cấu trúc từ server nếu lỗi
    }
  }

  const handleDragStart = (e, key) => {
    // Không bắt đầu kéo khi thao tác trong ô nhập liệu
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
      e.preventDefault()
      return
    }
    setDragKey(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)  // Firefox cần dữ liệu để khởi động kéo
  }

  const handleDragOver = (e) => {
    if (!dragKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const mode = (e.clientY - rect.top) > rect.height / 2 ? 'into' : 'before'
    setDragOverMode(prev => prev === mode ? prev : mode)
  }

  const handleDragEnter = (key) => {
    if (dragKey && key !== dragKey) setDragOverKey(key)
  }

  const handleDragEnd = () => { setDragKey(null); setDragOverKey(null); setDragOverMode('into') }

  const handleDrop = (e, targetKey) => {
    e.preventDefault()
    if (!dragKey || dragKey === targetKey) { handleDragEnd(); return }

    // Kéo một PHẦN/HỆ THỐNG thì cả cây con đi theo → không được thả vào chính cây con
    // của nó (sẽ tạo vòng lặp cha-con, mất dòng khỏi cây).
    const dragged = rows.find(r => r._key === dragKey)
    if (dragged && subtreeKeySet(rows, dragged).has(targetKey)) {
      alert('Không thể chuyển một phần/hệ thống vào chính dòng con của nó.')
      handleDragEnd()
      return
    }

    // Thả ở nửa dưới của dòng đích → chèn sau, nửa trên → chèn trước
    const rect = e.currentTarget.getBoundingClientRect()
    const after = (e.clientY - rect.top) > rect.height / 2

    let reordered = null
    setRows(prev => {
      const from = prev.findIndex(r => r._key === dragKey)
      const tIdx = prev.findIndex(r => r._key === targetKey)
      if (from < 0 || tIdx < 0) return prev
      const moved = prev[from]
      const target = prev[tIdx]

      // Nhấc cả khối: dòng đang kéo + toàn bộ con cháu (giữ nguyên thứ tự nội bộ)
      const blockKeys = subtreeKeySet(prev, moved)
      const block = prev.filter(r => blockKeys.has(r._key))
      const rest  = prev.filter(r => !blockKeys.has(r._key))

      // Gán cha theo loại dòng đích:
      //   thả nửa DƯỚI của PHẦN/NHÓM → thành con đầu tiên của nó
      //   thả nửa TRÊN của PHẦN/NHÓM → thành anh-em, chèn NGAY TRƯỚC nó (lối để kéo ra khỏi nhóm)
      //   thả lên dòng LÁ            → thành anh-em cùng cấp (kế thừa parent_id của dòng đích)
      const targetKind = target.row_kind || 'leaf'
      const t = rest.findIndex(r => r._key === targetKey)
      let newParentId, insertAt
      if (targetKind === 'zone' || targetKind === 'group') {
        newParentId = after ? (target.id ?? null) : (target.parent_id ?? null)
        insertAt = after ? t + 1 : t
      } else {
        newParentId = target.parent_id ?? null
        insertAt = after ? t + 1 : t
      }
      // Chỉ dòng gốc của khối đổi cha; con cháu giữ nguyên parent_id để cây không vỡ.
      rest.splice(insertAt, 0, { ...moved, parent_id: newParentId }, ...block.slice(1))
      reordered = rest
      return rest
    })
    if (reordered) persistOrder(reordered)
    handleDragEnd()
  }

  return {
    dragKey, dragOverKey, dragOverMode,
    handleDragStart, handleDragOver, handleDragEnter, handleDrop, handleDragEnd,
  }
}
