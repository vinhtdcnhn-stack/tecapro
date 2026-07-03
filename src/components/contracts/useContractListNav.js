import { useEffect, useRef } from 'react'

// Điều hướng bàn phím cho bảng HĐ bán: ↑/↓ chọn hàng, Space mở chi tiết,
// Alt+C lọc theo chủ đầu tư, Alt+P lọc theo PM của hàng đang chọn; đồng thời
// cuộn hàng đang chọn vào tầm nhìn. Tách khỏi ContractListPage cho gọn.
export function useContractListNav({ isMobile, list, selectedIndex, setSelectedIndex, setFilters, onManage, selectedRowRef }) {
  // Giữ danh sách + chỉ số mới nhất cho listener (tránh gắn lại mỗi lần render)
  const navRef = useRef({ list: [], selectedIndex: -1 })
  useEffect(() => { navRef.current.list = list; navRef.current.selectedIndex = selectedIndex })

  useEffect(() => {
    if (isMobile) return
    const onKeyDown = (e) => {
      // Bỏ qua khi đang gõ trong ô nhập liệu / phần tử soạn thảo
      const t = e.target
      const tag = t.tagName
      if (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const curList = navRef.current.list
      if (!curList || curList.length === 0) return
      const cur = navRef.current.selectedIndex
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.key === 'ArrowDown') {
          setSelectedIndex(cur < 0 ? 0 : Math.min(cur + 1, curList.length - 1))
        } else {
          setSelectedIndex(cur < 0 ? curList.length - 1 : Math.max(cur - 1, 0))
        }
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        // Alt + C: lọc theo chủ đầu tư của hàng đang chọn
        if (cur >= 0 && cur < curList.length) {
          e.preventDefault()
          setFilters(prev => ({ ...prev, customer_name: curList[cur].customer_name || '' }))
        }
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        // Alt + P: lọc theo PM chính của hàng đang chọn
        if (cur >= 0 && cur < curList.length) {
          e.preventDefault()
          setFilters(prev => ({ ...prev, pm_name: curList[cur].pm_name || '' }))
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        if (cur >= 0 && cur < curList.length) {
          e.preventDefault()
          if (onManage) onManage(curList[cur])
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMobile, onManage, setSelectedIndex, setFilters])

  // Cuộn hàng đang chọn vào tầm nhìn
  useEffect(() => {
    if (selectedIndex >= 0 && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, selectedRowRef])
}
