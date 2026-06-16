import { createContext, useContext } from 'react'

// Quyền GHI trong phạm vi một hợp đồng bán đang xem (chi tiết + các tab nhập con).
//   canEdit       = admin (role==1) hoặc PM của HĐ (PM chính/đồng-PM, member_role='PM').
//   canEditSerial = canEdit HOẶC là Kỹ thuật của HĐ (member_role='Technical') — chỉ mở
//                   cho các thao tác SERIAL (nhập/sửa/xóa/import/scan/thay thế) ở tab
//                   Nhận hàng & Quản lý serial; KHÔNG cho tạo/xóa đợt nhận hay chủng loại.
// Tính ở ContractManagementPage rồi provide xuống; nút/ô đọc qua <EditGuard> (mặc định
// canEdit) hoặc <EditGuard serial> (canEditSerial).
//
// Khớp đúng với chốt chặn server-side: contractAccess.js (PM/admin) cho phần chung và
// guard PM+Technical cho các route serial. UI bị qua mặt thì backend vẫn trả 403.
const ContractPermContext = createContext({ canEdit: false, canEditSerial: false })

// eslint-disable-next-line react-refresh/only-export-components
export const useCanEdit = () => useContext(ContractPermContext).canEdit
// eslint-disable-next-line react-refresh/only-export-components
export const useCanEditSerial = () => useContext(ContractPermContext).canEditSerial

export function ContractPermProvider({ canEdit, canEditSerial, children }) {
  return (
    <ContractPermContext.Provider value={{ canEdit: !!canEdit, canEditSerial: !!canEditSerial }}>
      {children}
    </ContractPermContext.Provider>
  )
}
