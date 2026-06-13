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

