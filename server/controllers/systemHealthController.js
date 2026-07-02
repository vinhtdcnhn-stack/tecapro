import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { pool } from '../db.js'
import { getCacheStats } from '../cache.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tổng quan sức khỏe hệ thống (CHỈ ADMIN, read-only) — phần cứng/OS + dịch vụ
// (PostgreSQL, Redis) + tiến trình Node + vài số liệu ứng dụng. Mỗi phần tự chịu
// lỗi riêng: phần nào hỏng thì trả null/ok:false thay vì làm vỡ cả endpoint.
// ──────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Tổng thời gian bận/rảnh trên tất cả nhân (để đo % dùng CPU bằng delta 2 mốc).
function cpuTotals() {
  let idle = 0, total = 0
  for (const c of os.cpus()) {
    for (const t in c.times) total += c.times[t]
    idle += c.times.idle
  }
  return { idle, total }
}

// % CPU trung bình toàn máy trong ~150ms. loadavg chỉ có ý nghĩa trên Linux (Windows = 0).
async function cpuUsagePct() {
  const a = cpuTotals()
  await sleep(150)
  const b = cpuTotals()
  const idleDiff = b.idle - a.idle
  const totalDiff = b.total - a.total
  if (totalDiff <= 0) return null
  return Math.round((1 - idleDiff / totalDiff) * 1000) / 10
}

// Dung lượng đĩa chứa thư mục làm việc. statfs có trên Node ≥19 (Linux + Windows).
async function diskInfo() {
  try {
    const s = await statfs(process.cwd())
    const totalBytes = s.blocks * s.bsize
    const freeBytes = s.bavail * s.bsize // bavail: khối trống cho user thường
    return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes }
  } catch {
    return null
  }
}

// PostgreSQL: phiên bản, kích thước DB, số kết nối theo trạng thái, + tình trạng pool app.
async function dbInfo() {
  try {
    const { rows } = await pool.query(`
      SELECT
        current_setting('server_version')                                          AS version,
        pg_database_size(current_database())::bigint                               AS size_bytes,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())  AS conn_total,
        (SELECT count(*) FROM pg_stat_activity
           WHERE datname = current_database() AND state = 'active')                 AS conn_active
    `)
    const r = rows[0]
    return {
      ok: true,
      version: r.version,
      sizeBytes: Number(r.size_bytes),
      connections: { total: Number(r.conn_total), active: Number(r.conn_active) },
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Vài số liệu ứng dụng (đếm nhanh; bảng chắc chắn tồn tại theo schema baseline).
async function appCounts() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*) FROM app_user)     AS users,
        (SELECT count(*) FROM customer)     AS customers,
        (SELECT count(*) FROM contract_out) AS contracts
    `)
    const r = rows[0]
    return { users: Number(r.users), customers: Number(r.customers), contracts: Number(r.contracts) }
  } catch {
    return null
  }
}

// GET /api/admin/system-health
export async function getSystemHealth(_req, res) {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const mem = process.memoryUsage()

  // Chạy song song các phần độc lập.
  const [usagePct, disk, db, app] = await Promise.all([
    cpuUsagePct(),
    diskInfo(),
    dbInfo(),
    appCounts(),
  ])
  const redis = await getCacheStats()

  const cpus = os.cpus()
  res.json({
    now: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSec: Math.round(os.uptime()),
      nodeVersion: process.version,
      cpu: {
        model: cpus[0]?.model?.trim() || null,
        cores: cpus.length,
        loadavg: os.loadavg(),          // [1m,5m,15m] — Windows trả [0,0,0]
        usagePct,                        // null nếu không đo được
      },
      mem: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: totalMem - freeMem,
      },
    },
    disk,
    process: {
      uptimeSec: Math.round(process.uptime()),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      env: process.env.NODE_ENV || 'development',
    },
    db,
    redis,
    app,
  })
}
