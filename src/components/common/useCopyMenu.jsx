import { useState, useCallback } from 'react'
import TaskContextMenu from '../contracts/TaskContextMenu'
import { copyToClipboard } from '../contracts/taskUtils'
import { useRowLongPress } from '../contracts/useLongPress'

// ── Hook gắn menu "Sao chép thông tin" cho từng hàng bảng ──────────────────────
// Chuột phải (desktop) hoặc ấn giữ (mobile) một hàng → mở menu chép một đoạn văn bản
// gọn mô tả hàng đó (đường dẫn HĐ + số liệu chính) để dán vào chat hỏi/báo tình hình.
//
//   buildText(row) → đoạn văn bản chép vào clipboard.
//   titleOf(row)   → (tùy chọn) tiêu đề hiển thị trên đầu menu; mặc định row.title.
//
// Trả về { getRowProps, copyMenu }: spread {...getRowProps(row)} lên <tr>, và render
// {copyMenu} một lần sau bảng (vd ngay trước thẻ đóng của vùng chứa).
export function useCopyMenu(buildText, titleOf) {
  const [ctx, setCtx] = useState(null)   // { x, y, task } | null

  const open = useCallback((row, x, y) => {
    const task = titleOf ? { ...row, title: titleOf(row) } : row
    setCtx({ x, y, task })
  }, [titleOf])

  const getLongPress = useRowLongPress((row, x, y) => open(row, x, y))

  const getRowProps = useCallback((row) => ({
    onContextMenu: (e) => { e.preventDefault(); open(row, e.clientX, e.clientY) },
    ...getLongPress(row),
  }), [open, getLongPress])

  const copyMenu = (
    <TaskContextMenu
      key={ctx ? `${ctx.x}-${ctx.y}` : 'closed'}
      menu={ctx}
      onCopy={(task) => copyToClipboard(buildText(task))}
      onClose={() => setCtx(null)}
    />
  )

  return { getRowProps, copyMenu }
}
