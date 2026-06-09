// Shared constants & helpers for the warranty tab and its sub-components.

export const CASE_STATUSES   = ['Tiếp nhận', 'Đang xử lý', 'Chờ phụ kiện', 'Hoàn thành', 'Đóng']
export const PRIORITIES      = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
export const ACTIVITY_TYPES  = ['Tiếp nhận', 'Kiểm tra hiện trường', 'Khắc phục', 'Thay thế thiết bị', 'Cập nhật tình trạng', 'Hoàn thành', 'Khác']
export const SERIAL_STATUSES = ['Đang hoạt động', 'Lỗi', 'Đã thay thế', 'Ngừng sử dụng']

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtDT   = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—'

export function toISODate(val) {
  if (!val && val !== 0) return null
  if (val instanceof Date) {
    // SheetJS (cellDates) neo ngày theo UTC nửa đêm → đọc bằng getUTC* để không bị
    // lệch ±1 ngày theo múi giờ máy. (Nhánh serial Excel bên dưới cũng dùng getUTC*.)
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2,'0')}-${String(val.getUTCDate()).padStart(2,'0')}`
  }
  const str = String(val).trim()
  // Chuỗi ngày ISO: YYYY-MM-DD hoặc YYYY/MM/DD (xử lý trước để không bị parseFloat nuốt thành số)
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) return `${iso[1]}-${String(+iso[2]).padStart(2,'0')}-${String(+iso[3]).padStart(2,'0')}`
  // Chỉ coi là serial Excel khi là SỐ THUẦN (tránh nhầm "2025-01-01" → 2025)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = parseFloat(str)
    if (!isNaN(n) && n > 1) {
      // Excel serial → UTC date (Excel epoch = Dec 30, 1899; Unix epoch offset = 25569 days)
      const d = new Date(Math.round((n - 25569) * 864e5))
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
    }
  }
  return str || null
}

export function warrantyStatus(to) {
  if (!to) return { label: 'Không xác định', cls: 'wty-badge--none' }
  const days = Math.ceil((new Date(to) - new Date(new Date().toDateString())) / 86400000)
  if (days < 0)  return { label: 'Hết bảo hành', cls: 'wty-badge--expired' }
  if (days <= 30) return { label: `Còn ${days} ngày`, cls: 'wty-badge--expiring' }
  return { label: 'Còn bảo hành', cls: 'wty-badge--active' }
}

// Hạn bảo hành hiệu lực của 1 serial: ưu tiên hạn riêng của serial, không có thì kế thừa thiết bị.
export const effWarranty = (serial, eq) => ({
  from: serial?.warranty_from || eq?.warranty_from || null,
  to:   serial?.warranty_to   || eq?.warranty_to   || null,
})

// Gộp toàn bộ serial của các thiết bị thành 1 danh sách phẳng để quản lý/thống kê.
export function flattenSerials(equipment) {
  const out = []
  for (const eq of equipment) {
    for (const s of (eq.serials || [])) {
      const eff = effWarranty(s, eq)
      out.push({ ...s, equipment_id: eq.id, eqName: eq.name, brand: eq.brand, model: eq.model,
                 effFrom: eff.from, effTo: eff.to })
    }
  }
  return out
}

// Thống kê theo TỪNG serial; thiết bị không có serial tính là 1 đơn vị theo hạn của thiết bị.
export function warrantyCounts(equipment) {
  const today = new Date(new Date().toDateString())
  const tos = []
  for (const eq of equipment) {
    const serials = eq.serials || []
    if (serials.length > 0) serials.forEach(s => tos.push(effWarranty(s, eq).to))
    else tos.push(eq.warranty_to || null)
  }
  let expiring = 0, expired = 0
  for (const to of tos) {
    if (!to) continue
    const days = Math.ceil((new Date(to) - today) / 86400000)
    if (days < 0) expired++
    else if (days <= 30) expiring++
  }
  const totalSerials = equipment.reduce((s, e) => s + (e.serials?.length || 0), 0)
  return { totalSerials, expiring, expired }
}

export function caseStatusCls(s) {
  return s === 'Tiếp nhận' ? 'cs--receive' : s === 'Đang xử lý' ? 'cs--progress' :
    s === 'Chờ phụ kiện' ? 'cs--waiting' : s === 'Hoàn thành' ? 'cs--done' : 'cs--closed'
}
export function caseStatusModalCls(s) {
  return s === 'Tiếp nhận' ? 'sel-receive' : s === 'Đang xử lý' ? 'sel-progress' :
    s === 'Chờ phụ kiện' ? 'sel-waiting' : s === 'Hoàn thành' ? 'sel-done' : 'sel-closed'
}
export function priorityCls(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' :
    p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
export function activityIcon(type) {
  return type === 'Tiếp nhận' ? '📥' : type === 'Kiểm tra hiện trường' ? '🔍' :
    type === 'Khắc phục' ? '🔧' : type === 'Thay thế thiết bị' ? '🔄' :
    type === 'Hoàn thành' ? '✅' : '📝'
}
