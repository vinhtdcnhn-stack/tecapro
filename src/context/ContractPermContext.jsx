import { createContext, useContext } from 'react'

// Quyền trong phạm vi một hợp đồng bán đang xem (chi tiết + các tab nhập con).
//   canEdit       = admin hoặc PM của HĐ — quyền GHI chung (giữ nguyên, backend chốt chặn).
//   canEditSerial = canEdit HOẶC Kỹ thuật — thao tác SERIAL.
//   canLinkSupply = quyền sửa RIÊNG cột "Nhập cho" của bảng giá mua. Trong tab HĐ nhập,
//                   canEdit bị thu hẹp về "người tạo HĐ nhập", nhưng PM của HĐ bán ĐANG XEM
//                   vẫn phải tự ghép được hàng của dự án mình → cờ riêng, mặc định = canEdit.
//   perms         = tập quyền HĐ lớp B (co.*/ci.* .view/.manage + section) của user, do
//                   server tính (loadContractPermissions) và truyền xuống. Dùng để ẩn/hiện
//                   TAB theo .view và ẩn khối "xem một phần" theo section. KHÔNG chặn GET.
// Nếu `perms` không được cung cấp (vd tab tài liệu gói thầu) → không lọc (canView=true),
// canManage lùi về canEdit để giữ tương thích.
const ContractPermContext = createContext({ canEdit: false, canEditSerial: false })

// eslint-disable-next-line react-refresh/only-export-components
export const useCanEdit = () => useContext(ContractPermContext).canEdit
// eslint-disable-next-line react-refresh/only-export-components
export const useCanEditSerial = () => useContext(ContractPermContext).canEditSerial
// eslint-disable-next-line react-refresh/only-export-components
export const useContractPerm = () => useContext(ContractPermContext)

export function ContractPermProvider({ canEdit, canEditSerial, canLinkSupply, perms, children }) {
  const hasPerms = Array.isArray(perms) || perms instanceof Set
  const set = hasPerms ? new Set(perms) : null
  const value = {
    canEdit: !!canEdit,
    canEditSerial: !!canEditSerial,
    canLinkSupply: canLinkSupply === undefined ? !!canEdit : !!canLinkSupply,
    // Tập quyền HĐ thô — để provider lồng (vd ContractInTab) truyền tiếp xuống.
    perms: hasPerms ? [...set] : undefined,
    canView: (key) => !hasPerms || set.has(key),
    canManage: (key) => !hasPerms ? !!canEdit : set.has(key),
    canSection: (key) => !hasPerms || set.has(key),
  }
  return (
    <ContractPermContext.Provider value={value}>
      {children}
    </ContractPermContext.Provider>
  )
}
