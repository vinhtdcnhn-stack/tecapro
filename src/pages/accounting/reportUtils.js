export const fmtMoney = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
export const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtPct   = (r) => (r == null ? '—' : Math.round((parseFloat(r) || 0) * 100) + '%')

export const TIER_CLASS = { '1-7': 'tier-1', '8-15': 'tier-2', '16-30': 'tier-3', '>30': 'tier-4' }

export const endOfThisMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
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
