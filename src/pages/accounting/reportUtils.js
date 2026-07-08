import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export const fmtMoney = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
export const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtPct   = (r) => (r == null ? '—' : Math.round((parseFloat(r) || 0) * 100) + '%')

export const TIER_CLASS = { '1-7': 'tier-1', '8-15': 'tier-2', '16-30': 'tier-3', '>30': 'tier-4' }

// Hôm nay theo giờ ĐỊA PHƯƠNG (yyyy-mm-dd) để so với ô ngày báo cáo (cũng giờ địa phương).
export const todayLocal = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export const endOfThisMonth = () => {
  const d = new Date()
  // Ghép ngày theo giờ ĐỊA PHƯƠNG — không qua toISOString() (UTC) để tránh lệch 1 ngày
  // (VN +7 khiến ngày cuối tháng bị lùi về 29/30, làm sót khoản đáo hạn ngày cuối tháng).
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const mm = String(last.getMonth() + 1).padStart(2, '0')
  const dd = String(last.getDate()).padStart(2, '0')
  return `${last.getFullYear()}-${mm}-${dd}`
}

// Gọi lại `fn` mỗi khi người dùng quay lại tab/cửa sổ (chuyển sang app/tab khác rồi quay
// lại). Dùng cho các báo cáo kế toán đọc-only để luôn thấy số mới nhất khi người khác vừa
// sửa dữ liệu, không phải F5 thủ công. Các endpoint báo cáo đều là conditional GET (ETag/
// 304 — xem reportNotModified ở server) nên lần gọi lại rất nhẹ khi dữ liệu chưa đổi. Nên
// truyền hàm refetch "im lặng" (không bật cờ loading) để không nhấp nháy "Đang tải...".
// KHÔNG tự chạy khi mount — useEffect load ban đầu của từng trang đã lo việc đó.
export function useRefetchOnFocus(fn) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })   // giữ tham chiếu hàm mới nhất (ngoài giai đoạn render)
  useEffect(() => {
    let last = 0
    const run = () => {
      if (document.visibilityState === 'hidden') return   // đang rời tab → bỏ qua
      const now = Date.now()
      if (now - last < 500) return   // gộp 'focus' + 'visibilitychange' xảy ra sát nhau
      last = now
      ref.current?.()
    }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [])
}

// Hook điều hướng tới đúng tab trong chi tiết hợp đồng (mở từ một hàng báo cáo kế toán).
// goContract(contractOutId, { tab, inId, inTab }):
//   tab   — menu HĐ bán: 'contract-debt' (công nợ phải thu), 'contract-warranty', ...
//   inId  — id HĐ nhập cần mở (khi tab = 'purchase-contract-info')
//   inTab — sub-tab HĐ nhập: 'payment' (thanh toán), ...
export function useContractNav() {
  const navigate = useNavigate()
  return useCallback((contractOutId, { tab, inId, inTab } = {}) => {
    if (!contractOutId) return
    const qs = new URLSearchParams()
    if (tab) qs.set('tab', tab)
    if (inId) qs.set('inId', String(inId))
    if (inTab) qs.set('inTab', inTab)
    const s = qs.toString()
    navigate(`/qlda/${contractOutId}${s ? `?${s}` : ''}`)
  }, [navigate])
}

// Xuất bảng ra Excel. columns: [{ label, value:(row)=>cell }]. rows: dữ liệu.
export async function exportTable(filename, sheetName, columns, rows) {
  const XLSX = await import('xlsx')
  const aoa = [columns.map(c => c.label), ...rows.map(r => columns.map(c => c.value(r)))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}
