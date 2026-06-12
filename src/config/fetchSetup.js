// Mặc định gửi cookie phiên (httpOnly) kèm MỌI request — kể cả cross-origin khi dev
// (Vite :5173 → API :5174). Nhờ vậy không phải sửa từng lời gọi fetch rải rác trong app.
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => nativeFetch(input, { credentials: 'include', ...init })
