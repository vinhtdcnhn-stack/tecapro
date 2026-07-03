import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { pool } from '../db.js'
import { getCacheStats } from '../cache.js'
import { onlineUserIds } from '../services/presence.js'

const execAsync = promisify(exec)

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
    const online = await onlineInfo()
    return {
      users: Number(r.users),
      customers: Number(r.customers),
      contracts: Number(r.contracts),
      online,
    }
  } catch {
    return null
  }
}

// Người dùng "đang online" = còn giữ long-poll gần đây (services/presence.js). Kèm tên
// để hiển thị danh sách. Thất bại phần tra tên vẫn giữ được con số đếm.
async function onlineInfo() {
  const ids = onlineUserIds()
  if (!ids.length) return { count: 0, users: [] }
  try {
    const { rows } = await pool.query(
      `SELECT id, COALESCE(NULLIF(full_name, ''), email) AS name
         FROM app_user WHERE id = ANY($1::int[]) ORDER BY name`,
      [ids],
    )
    return { count: ids.length, users: rows.map((u) => u.name) }
  } catch {
    return { count: ids.length, users: [] }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Bảo mật: số IP dò quét/tấn công đang bị fail2ban chặn. CHỈ có trên VPS (Linux);
// máy Windows dev không cài fail2ban → trả available:false kèm ghi chú. Đọc qua
// `fail2ban-client` (cần chạy được lệnh — thường app chạy quyền đủ trên VPS). Kết quả
// được cache ngắn để không spawn tiến trình mỗi 6s khi tab tự làm mới.
// ──────────────────────────────────────────────────────────────────────────────
let securityCache = { at: 0, data: null }
const SECURITY_TTL_MS = 20000

function parseField(text, label) {
  // Dòng dạng "   |- Currently banned:\t2" — lấy số sau nhãn.
  const m = text.match(new RegExp(`${label}:\\s*(\\d+)`))
  return m ? Number(m[1]) : 0
}

async function securityInfo() {
  if (process.platform === 'win32') {
    return { available: false, hint: 'fail2ban chỉ chạy trên VPS (Linux).' }
  }
  if (securityCache.data && Date.now() - securityCache.at < SECURITY_TTL_MS) {
    return securityCache.data
  }
  try {
    const opts = { timeout: 4000 }
    const { stdout: statusOut } = await execAsync('fail2ban-client status', opts)
    // "`- Jail list:\tnginx-bad-request, sshd" → danh sách tên jail.
    const listLine = statusOut.split('\n').find((l) => /Jail list:/.test(l)) || ''
    const jailNames = (listLine.split(/Jail list:/)[1] || '')
      .split(',').map((s) => s.trim()).filter(Boolean)

    const jails = []
    let currentlyBanned = 0, totalBanned = 0, totalFailed = 0
    for (const name of jailNames) {
      try {
        const { stdout } = await execAsync(`fail2ban-client status ${name}`, opts)
        const cur = parseField(stdout, 'Currently banned')
        const tot = parseField(stdout, 'Total banned')
        const failed = parseField(stdout, 'Total failed')
        currentlyBanned += cur; totalBanned += tot; totalFailed += failed
        jails.push({ name, currentlyBanned: cur, totalBanned: tot, totalFailed: failed })
      } catch {
        jails.push({ name, currentlyBanned: null, totalBanned: null, totalFailed: null })
      }
    }
    const data = { available: true, currentlyBanned, totalBanned, totalFailed, jails }
    securityCache = { at: Date.now(), data }
    return data
  } catch (err) {
    // 127 = không tìm thấy lệnh; EACCES/quyền → không đọc được socket fail2ban.
    const notFound = /not found|ENOENT|127/.test(err.message || '') || err.code === 127
    const data = {
      available: false,
      hint: notFound
        ? 'Chưa cài fail2ban hoặc không tìm thấy lệnh fail2ban-client.'
        : 'Không đọc được fail2ban (thiếu quyền chạy fail2ban-client?).',
    }
    // Cache cả trạng thái không đọc được để tránh spawn lỗi liên tục.
    securityCache = { at: Date.now(), data }
    return data
  }
}

// GET /api/admin/system-health
export async function getSystemHealth(_req, res) {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const mem = process.memoryUsage()

  // Chạy song song các phần độc lập.
  const [usagePct, disk, db, app, security] = await Promise.all([
    cpuUsagePct(),
    diskInfo(),
    dbInfo(),
    appCounts(),
    securityInfo(),
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
    security,
  })
}
