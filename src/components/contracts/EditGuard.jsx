import { useContractPerm } from '../../context/ContractPermContext'

// Bọc một vùng có thao tác ghi. Nếu user KHÔNG có quyền thì vô hiệu hóa toàn bộ
// control con bằng fieldset[disabled] — cơ chế native lan xuống mọi
// <button>/<input>/<select>/<textarea> bên trong.
//
// Cách gate (ưu tiên từ trên xuống):
//   • prop `perm="co.x.manage"` → theo RBAC lớp B của tab (canManage). Đây là cách mới,
//     để MA TRẬN phân quyền điều khiển nút ghi. Mặc định (bootstrap) = PM nên tương đương
//     hành vi cũ, nhưng admin có thể cấp cho vai trò khác.
//   • prop `serial` → quyền SERIAL (PM/admin/Kỹ thuật).
//   • không prop → quyền sửa HĐ chung (PM/admin).
//
// Dùng display:contents để fieldset KHÔNG tạo hộp bố cục: con render y như khi
// không có wrapper, nên không phá chuỗi min-width/overflow của các bảng cuộn
// ngang trong tab chi tiết. Khi có quyền, render thẳng children (không bọc gì).
//
// LƯU Ý: chỉ chặn được form control. Các phần tử click-được không phải control
// (<a>, <div onClick>, kéo-thả) phải tự gate bằng useCanEdit()/useContractPerm().
export default function EditGuard({ children, style, serial = false, perm }) {
  const { canEdit, canEditSerial, canManage } = useContractPerm()
  const allowed = perm ? canManage(perm) : (serial ? canEditSerial : canEdit)
  if (allowed) return children
  return (
    <fieldset
      disabled
      style={{ display: 'contents', border: 0, margin: 0, padding: 0, minInlineSize: 0, ...style }}
    >
      {children}
    </fieldset>
  )
}
