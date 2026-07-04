import { createContext, useContext, useState, useEffect } from 'react'

// Cầu nối cho "thanh chọn mục trong module" trên MOBILE. Sidebar (danh sách trang con của
// một module: Đấu thầu, KT Cơ điện…) bị ẩn ở mobile, nên trang con tự ĐĂNG KÝ danh sách
// mục của mình vào đây; Header đọc ra và vẽ 1 nút icon (cạnh nút trợ giúp) để chuyển trang.
//
// nav = { base, current, items:[{ label, value }] } — Header điều hướng tới `${base}/${value}`.
const SectionNavContext = createContext(null)

export function SectionNavProvider({ children }) {
  const [sectionNav, setSectionNav] = useState(null)
  return (
    <SectionNavContext.Provider value={{ sectionNav, setSectionNav }}>
      {children}
    </SectionNavContext.Provider>
  )
}

// Header dùng để đọc thanh chọn mục hiện tại (null nếu trang không đăng ký).
// eslint-disable-next-line react-refresh/only-export-components
export function useSectionNav() {
  return useContext(SectionNavContext)?.sectionNav ?? null
}

// Trang con gọi hook này để đăng ký thanh chọn mục; tự xoá khi rời trang. Serialize để
// so sánh nội dung (tránh vòng lặp do object mới mỗi lần render) — vì vậy items chỉ chứa
// dữ liệu thuần (label/value), việc điều hướng do Header lo bằng base + value.
// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterSectionNav(nav) {
  const ctx = useContext(SectionNavContext)
  const serialized = JSON.stringify(nav ?? null)
  useEffect(() => {
    if (!ctx) return
    ctx.setSectionNav(serialized === 'null' ? null : JSON.parse(serialized))
    return () => ctx.setSectionNav(null)
    // ctx.setSectionNav ổn định (từ useState); chỉ chạy lại khi nội dung nav đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])
}
