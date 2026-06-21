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

// Xuất bảng ra Excel. columns: [{ label, value:(row)=>cell }]. rows: dữ liệu.
export async function exportTable(filename, sheetName, columns, rows) {
  const XLSX = await import('xlsx')
  const aoa = [columns.map(c => c.label), ...rows.map(r => columns.map(c => c.value(r)))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}
