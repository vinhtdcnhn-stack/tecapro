// Ô "Trạng thái" trong form thêm/sửa HĐ bán.
// Lựa chọn "Hoàn thành" chỉ bật cho người được chốt HĐ (Trưởng/Phó Ban Triển khai Dự án +
// admin — server kiểm tra lại bằng canToggleCompletion). HĐ đã Hoàn thành bị khóa toàn bộ nên
// form sửa không mở được; muốn mở lại dùng nút "Chuyển về Đang thực hiện" ở trang chi tiết.
export default function ContractStatusField({ value, onChange, canComplete = false }) {
  return (
    <div className="form-group">
      <label>Trạng thái</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="Pending">Chờ xử lý</option>
        <option value="Active">Đang thực hiện</option>
        <option value="Completed" disabled={!canComplete && value !== 'Completed'}>
          Hoàn thành{!canComplete ? ' (chỉ TP/PP Ban Triển khai Dự án)' : ''}
        </option>
        <option value="Cancelled">Hủy bỏ</option>
      </select>
    </div>
  )
}
