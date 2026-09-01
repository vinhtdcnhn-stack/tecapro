// Xuất danh sách serial của hợp đồng NHẬP ra Excel — đúng những gì đang hiển thị ở
// tab "Quản lý Serial" (đã áp bộ lọc/tìm kiếm), cột khớp thứ tự cột trên bảng.
export async function exportInSerials(rows, contractNo = '') {
  if (!rows.length) { alert('Không có serial nào để xuất.'); return }

  // Tra tên máy cha theo id để cột "Thuộc máy" ra serial thay vì id.
  const byId = new Map(rows.map(r => [String(r.id), r.serial_no]))

  const aoa = [['#', 'Chủng loại hàng', 'Serial', 'Đợt nhận', 'Tình trạng', 'Thuộc máy', 'Ghi chú']]
  rows.forEach((r, i) => aoa.push([
    i + 1,
    r.item_name || '',
    r.serial_no || '',
    r.batch_name || '',
    r.status || 'Đang hoạt động',
    r.parent_serial_id ? (byId.get(String(r.parent_serial_id)) || '') : '',
    r.note || '',
  ]))

  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Serial')
  const tag = (contractNo || 'hd_nhap').replace(/[^\w]+/g, '_')
  XLSX.writeFile(wb, `serial_${tag}.xlsx`)
}
