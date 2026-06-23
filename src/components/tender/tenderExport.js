import { fmtDate, fmtMoney } from './tenderUtils'

// Xuất danh sách gói thầu ra Excel theo đúng thứ tự cột bảng theo dõi (mẫu A).
export async function exportTenders(rows) {
  const XLSX = await import('xlsx')
  const header = [
    'STT', 'Tên gói thầu', 'Mã gói thầu', 'Chủ đầu tư', 'Dự toán', 'Tiền tệ', 'Tỷ giá', 'Ngày nộp',
    'Lĩnh vực', 'Bảo lãnh', 'Số PAKD', 'Số UQ', 'QĐ giao nhiệm vụ',
    'Người làm thầu', 'AM phụ trách', 'Tình trạng', 'Ghi chú', 'Kết quả',
  ]
  const aoa = [header, ...rows.map((r, i) => [
    i + 1, r.package_name, r.package_code, r.investor, fmtMoney(r.estimate),
    r.currency_code || 'VND', r.currency_code && r.currency_code !== 'VND' ? r.exchange_rate : '',
    fmtDate(r.submit_date),
    r.field, r.guarantee, r.pakd_no, r.uq_no, r.assign_decision,
    r.bid_maker_name, r.am_name, r.workflow_status, r.note, r.result,
  ])]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Đấu thầu')
  XLSX.writeFile(wb, `dau-thau-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
