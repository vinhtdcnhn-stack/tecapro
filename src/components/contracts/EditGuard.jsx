import { useCanEdit } from '../../context/ContractPermContext'

// Bọc một vùng có thao tác ghi. Nếu user KHÔNG có quyền sửa hợp đồng (không phải
// PM/admin) thì vô hiệu hóa toàn bộ control con bằng fieldset[disabled] — cơ chế
// native lan xuống mọi <button>/<input>/<select>/<textarea> bên trong.
//
// Dùng display:contents để fieldset KHÔNG tạo hộp bố cục: con render y như khi
// không có wrapper, nên không phá chuỗi min-width/overflow của các bảng cuộn
// ngang trong tab chi tiết. Với PM/admin, render thẳng children (không bọc gì).
//
// LƯU Ý: chỉ chặn được form control. Các phần tử click-được không phải control
// (<a>, <div onClick>, kéo-thả) phải tự gate bằng useCanEdit() ở nơi dùng.
export default function EditGuard({ children, style }) {
  const canEdit = useCanEdit()
  if (canEdit) return children
  return (
    <fieldset
      disabled
      style={{ display: 'contents', border: 0, margin: 0, padding: 0, minInlineSize: 0, ...style }}
    >
      {children}
    </fieldset>
  )
}
