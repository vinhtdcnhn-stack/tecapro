// Ánh xạ tên bảng/cột kỹ thuật → nhãn tiếng Việt cho trang Nhật ký thay đổi, và định dạng
// giá trị để hiển thị diff cũ→mới. Cột/bảng chưa khai báo → hiện key thô (bổ sung dần).

// Bảng → nhãn đối tượng.
export const TABLE_LABELS = {
  contract_out: 'Hợp đồng bán',
  contract_out_member: 'Thành viên hợp đồng',
  contract_out_boq: 'Dòng bảng giá (BOQ)',
  contract_out_progress: 'Tiến độ theo biên bản',
  contract_receivable: 'Lịch công nợ phải thu',
  contract_receivable_payment: 'Tiền về (công nợ)',
  contract_task: 'Công việc triển khai',
  contract_task_attachment: 'Tệp đính kèm công việc',
  contract_guarantee: 'Bảo lãnh',
  contract_equipment: 'Thiết bị bàn giao',
  equipment_serial: 'Serial thiết bị',
  contract_out_delivery: 'Đợt giao hàng (HĐ bán)',
  contract_out_invoice: 'Hóa đơn',
  contract_out_invoice_item: 'Dòng hóa đơn',
  warranty_case: 'Case bảo hành',
  warranty_case_equipment: 'Thiết bị trong case bảo hành',
  warranty_activity: 'Nhật ký xử lý bảo hành',
  document: 'Tài liệu hợp đồng',
  document_file: 'Tệp tài liệu',
  document_folder: 'Thư mục tài liệu',
  contract_in: 'Hợp đồng nhập',
  contract_in_boq: 'Bảng giá mua (HĐ nhập)',
  contract_in_payable: 'Lịch thanh toán (HĐ nhập)',
  contract_in_payment: 'Thanh toán (HĐ nhập)',
  contract_in_delivery: 'Đợt nhận hàng',
  contract_in_delivery_item: 'Dòng nhận hàng',
  contract_in_delivery_serial: 'Serial nhận hàng',
  contract_in_guarantee: 'Bảo lãnh (HĐ nhập)',
  contract_in_customs: 'Xuất nhập khẩu',
  contract_in_logistics: 'Logistics',
  contract_in_logistics_update: 'Cập nhật logistics',
  contract_in_progress: 'Tiến độ theo BB (HĐ nhập)',
  contract_in_supplier_warranty: 'Bảo hành NCC',
  contract_in_warranty_claim: 'Yêu cầu bảo hành NCC',
}

export const tableLabel = (t) => TABLE_LABELS[t] || t

// Cột → nhãn trường (dùng chung mọi bảng). Key chưa khai → hiện thô.
export const FIELD_LABELS = {
  description: 'Diễn giải',
  name: 'Tên',
  title: 'Tiêu đề',
  note: 'Ghi chú',
  notes: 'Ghi chú',
  status: 'Trạng thái',
  amount: 'Số tiền',
  amount_before_vat: 'Thành tiền trước VAT',
  amount_after_vat: 'Thành tiền sau VAT',
  unit_price: 'Đơn giá',
  quantity: 'Số lượng',
  unit: 'Đơn vị',
  vat_rate: 'Thuế suất VAT',
  vat_percent: 'Thuế suất VAT',
  currency_code: 'Loại tiền',
  exchange_rate: 'Tỷ giá',
  due_date: 'Ngày đến hạn',
  delay_reason: 'Lý do trễ',
  contract_no: 'Số hợp đồng',
  contract_date: 'Ngày ký',
  start_date: 'Ngày bắt đầu',
  finish_date: 'Ngày kết thúc',
  signed_date: 'Ngày ký',
  invoice_no: 'Số hóa đơn',
  invoice_date: 'Ngày hóa đơn',
  serial: 'Serial',
  serial_no: 'Serial',
  model: 'Model',
  member_role: 'Vai trò',
  user_id: 'Người dùng',
  created_by: 'Người tạo',
  sort_order: 'Thứ tự',
  is_deleted: 'Đã xóa',
  project_name: 'Tên dự án',
  tender_name: 'Tên gói thầu',
  customer_id: 'Khách hàng',
  supplier_id: 'Nhà cung cấp',
  file_name: 'Tên tệp',
  folder_id: 'Thư mục',
}

export const fieldLabel = (col) => FIELD_LABELS[col] || col

export const OP_LABELS = { I: 'Tạo mới', U: 'Sửa', D: 'Xóa' }
export const OP_COLORS = { I: '#15803d', U: '#b45309', D: '#c00' }

// Định dạng một giá trị JSON thô để hiển thị.
export function fmtValue(v) {
  if (v === null || v === undefined || v === '') return '(trống)'
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  // Ngày dạng YYYY-MM-DD → dd/mm/yyyy.
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (dm) return `${dm[3]}/${dm[2]}/${dm[1]}`
  // Mốc thời gian ISO → locale vi-VN.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('vi-VN')
  }
  // Số (kể cả dạng chuỗi thập phân) → nhóm hàng nghìn vi-VN.
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
  }
  return s
}

export function fmtDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN')
}
