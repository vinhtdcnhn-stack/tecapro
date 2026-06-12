import { createRateLimiter } from './rateLimit.js'

// Chống brute-force đăng nhập: tối đa 10 lần SAI theo IP trong 15 phút.
// guard (middleware) chặn khi vượt ngưỡng; fail(req) gọi trong controller mỗi lần sai.
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau ít phút.',
})
