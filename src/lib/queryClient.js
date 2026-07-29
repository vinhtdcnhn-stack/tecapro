import { QueryClient } from '@tanstack/react-query'

// Một QueryClient dùng chung cho toàn app — cũng là nơi lớp prefetch (idle/hover) ghi
// dữ liệu vào để khi component mount lên thì đọc tức thì từ cache thay vì chờ mạng.
//
// Backend đã được cache qua Redis, nên ở client ta dùng chiến lược stale-while-revalidate:
//   • staleTime 60s   → trong 1 phút coi dữ liệu còn "tươi": render NGAY từ cache, không gọi lại.
//   • gcTime  30 phút → giữ cache trong bộ nhớ 30 phút sau khi không còn ai dùng (chuyển trang
//                       qua lại không phải tải lại).
//   • refetchOnWindowFocus → bật để khi người dùng quay lại tab thì làm mới ngầm (không chớp UI
//                       vì vẫn hiển thị dữ liệu cũ trong lúc tải).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      // Lỗi 4xx (401/403/404...) là do quyền/đường dẫn — thử lại cũng vẫn hỏng, chỉ làm UI
      // chậm hiện thông báo. Chỉ thử lại 1 lần với lỗi mạng / 5xx.
      retry: (count, err) => (err?.status >= 400 && err?.status < 500) ? false : count < 1,
    },
  },
})
