import pg from 'pg'

const { Pool, types } = pg

// Return DATE columns as plain "YYYY-MM-DD" strings, not Date objects
// (prevents UTC-to-local conversion shifting the date by ±1 day)
types.setTypeParser(1082, val => val)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

