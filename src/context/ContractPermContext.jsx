import { createContext, useContext } from 'react'

// Quyền GHI trong phạm vi một hợp đồng bán đang xem (chi tiết + các tab nhập con).
// canEdit = true khi user là admin (role==1) hoặc là PM của hợp đồng đó
// (PM chính lẫn đồng-PM, member_role='PM'). Tính ở ContractManagementPage rồi
// provide xuống; mọi nút Thêm/Sửa/Xóa và ô nhập inline đọc qua <EditGuard>.
//
// Khớp đúng với chốt chặn server-side ở server/middleware/contractAccess.js (F-11):
// kể cả khi UI bị qua mặt, backend vẫn trả 403 cho user không phải PM.
const ContractPermContext = createContext(false)

// eslint-disable-next-line react-refresh/only-export-components
export const useCanEdit = () => useContext(ContractPermContext)

export function ContractPermProvider({ canEdit, children }) {
  return (
    <ContractPermContext.Provider value={!!canEdit}>
      {children}
    </ContractPermContext.Provider>
  )
}
