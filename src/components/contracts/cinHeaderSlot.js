import { createContext, useContext } from 'react'

// Vùng "slot" ở góc phải header chi tiết HĐ nhập (mobile) để tab đang mở
// đẩy nút thao tác chính của nó lên (vd: "Thêm đợt nhận hàng" → icon).
// Giá trị context là DOM node của slot; tab dùng createPortal để render vào.
export const CinHeaderSlotContext = createContext(null)
export const useCinHeaderSlot = () => useContext(CinHeaderSlotContext)
