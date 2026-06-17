import pg from 'pg'

const { Pool, types } = pg

// Return DATE columns as plain "YYYY-MM-DD" strings, not Date objects
// (prevents UTC-to-local conversion shifting the date by ±1 day)
types.setTypeParser(1082, val => val)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                        // số connection tối đa (mặc định pg là 10)
  idleTimeoutMillis: 30000,       // đóng connection rảnh sau 30s
  connectionTimeoutMillis: 5000,  // chờ tối đa 5s khi pool đã cạn rồi mới báo lỗi
})

// Lỗi trên client ĐANG RẢNH trong pool (vd DB rớt kết nối khi máy ngủ/DB restart)
// được phát ở pool. Bắt buộc có listener, nếu không Node sẽ ném lỗi làm sập tiến
// trình API. Chỉ cần log: pg tự loại client hỏng và tạo client mới ở request sau.
pool.on('error', (err) => {
  console.error('[db] Idle client error (pool sẽ tự hồi phục):', err.message)
})

