import { useCanEdit, useCanEditSerial } from '../../context/ContractPermContext'

// Bọc một vùng có thao tác ghi. Nếu user KHÔNG có quyền thì vô hiệu hóa toàn bộ
// control con bằng fieldset[disabled] — cơ chế native lan xuống mọi
// <button>/<input>/<select>/<textarea> bên trong.
//
// Mặc định gate theo quyền sửa hợp đồng (PM/admin). Truyền prop `serial` để gate
// theo quyền SERIAL (PM/admin/Kỹ thuật) — dùng cho các vùng nhập/sửa serial.
//
// Dùng display:contents để fieldset KHÔNG tạo hộp bố cục: con render y như khi
// không có wrapper, nên không phá chuỗi min-width/overflow của các bảng cuộn
// ngang trong tab chi tiết. Khi có quyền, render thẳng children (không bọc gì).
//
// LƯU Ý: chỉ chặn được form control. Các phần tử click-được không phải control
// (<a>, <div onClick>, kéo-thả) phải tự gate bằng useCanEdit()/useCanEditSerial().
export default function EditGuard({ children, style, serial = false }) {
  const canEdit = useCanEdit()
  const canEditSerial = useCanEditSerial()
  if (serial ? canEditSerial : canEdit) return children
  return (
    <fieldset
      disabled
      style={{ display: 'contents', border: 0, margin: 0, padding: 0, minInlineSize: 0, ...style }}
    >
      {children}
    </fieldset>
  )
}
