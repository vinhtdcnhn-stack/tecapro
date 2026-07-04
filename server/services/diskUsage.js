import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ──────────────────────────────────────────────────────────────────────────────
// Phân rã dung lượng đĩa: đo riêng thư mục uploads (tệp đính kèm, ~chục GB) và thư
// mục backup (.tar sao lưu, rất dễ phình). Quét cả cây thư mục lớn RẤT tốn kém nên
// kết quả được cache 10 phút theo kiểu stale-while-revalidate: trả ngay số đo cũ,
// nền tự đo lại khi quá hạn — KHÔNG bao giờ chặn request /system-health (tự làm mới 6s).
// ──────────────────────────────────────────────────────────────────────────────

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '..')
const UPLOADS_DIR = path.join(SERVER_DIR, 'uploads')
// Cùng quy ước với adminUploadsBackupController.js.
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(SERVER_DIR, '..', 'backups')

const TTL_MS = 10 * 60 * 1000 // đo lại mỗi 10 phút

let cache = { at: 0, data: null }
let computing = false

// Đệ quy JS — dùng cho Windows (dev, uploads nhỏ) hoặc khi `du` lỗi. Bỏ qua tệp/thư mục
// đọc lỗi thay vì vỡ cả phép đo.
function walk(dir) {
  let total = 0
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return 0 }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    try {
      if (e.isDirectory()) total += walk(p)
      else if (e.isFile()) total += fs.statSync(p).size
    } catch { /* bỏ qua tệp lỗi */ }
  }
  return total
}

// Dung lượng 1 thư mục (bytes). Linux/macOS ưu tiên `du -sb` (1 tiến trình, nhanh hơn
// nhiều so với đệ quy JS trên cây lớn); Windows và khi du lỗi → đệ quy JS. 0 nếu không có.
async function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0
  if (process.platform !== 'win32') {
    try {
      const { stdout } = await execAsync(`du -sb "${dir}"`, { timeout: 60000, maxBuffer: 1 << 20 })
      const n = parseInt(stdout.split(/\s+/)[0], 10)
      return Number.isFinite(n) ? n : walk(dir)
    } catch {
      return walk(dir)
    }
  }
  return walk(dir)
}

async function recompute() {
  computing = true
  try {
    const [uploadsBytes, backupBytes] = await Promise.all([dirSize(UPLOADS_DIR), dirSize(BACKUP_DIR)])
    cache = { at: Date.now(), data: { uploadsBytes, backupBytes, measuredAt: new Date().toISOString() } }
  } finally {
    computing = false
  }
}

// Trả phân rã đã cache; kích hoạt đo lại nền khi quá hạn. Lần đầu (chưa có số đo) trả
// { computing:true } để FE hiển thị "đang đo…".
export function getDiskBreakdown() {
  const fresh = cache.data && Date.now() - cache.at < TTL_MS
  if (!fresh && !computing) recompute().catch(() => { computing = false })
  return cache.data ? { ...cache.data, computing } : { computing: true }
}
