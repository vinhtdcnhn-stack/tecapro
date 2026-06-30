import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { notifyAction } from '../services/notify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '..')
const UPLOADS_DIR = path.join(SERVER_DIR, 'uploads')
// Thư mục chứa các bản sao uploads trên đĩa VPS (ngoài uploads để tránh tự gói chính nó).
// Cấu hình qua BACKUP_DIR; mặc định <repo>/backups (đã .gitignore).
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(SERVER_DIR, '..', 'backups')

const RESTORE_CONFIRM = 'KHÔI PHỤC'

const fwd = p => p.replace(/\\/g, '/')
const rmrf = p => { try { fs.rmSync(p, { recursive: true, force: true }) } catch { /* ignore */ } }
function timestamp() {
  const d = new Date(); const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }
// Chỉ cho phép tên tệp đơn (không đường dẫn) và là .tar — chống path traversal khi tải/xoá/khôi phục.
function safeBackupFile(name) {
  const base = path.basename(String(name || ''))
  if (base !== name || !/\.tar$/i.test(base)) return null
  const abs = path.join(BACKUP_DIR, base)
  if (path.dirname(abs) !== BACKUP_DIR) return null
  return abs
}

// ── Trạng thái job (một job tại một thời điểm) ────────────────────────────────
// uploads rất lớn (hàng chục GB) → gói/giải nén chạy NỀN, client poll trạng thái.
let job = { state: 'idle', kind: null, file: null, startedAt: null, finishedAt: null, error: null }
const jobView = () => ({ ...job })

// ── Tạo bản sao uploads: POST /api/admin/uploads-backup ───────────────────────
export async function buildUploadsBackup(req, res) {
  if (job.state === 'running') return res.status(409).json({ error: 'Đang có một tác vụ chạy, vui lòng đợi.' })
  ensureDir(BACKUP_DIR)
  ensureDir(UPLOADS_DIR)
  const out = path.join(BACKUP_DIR, `uploads-${timestamp()}.tar`)
  job = { state: 'running', kind: 'build', file: path.basename(out), startedAt: Date.now(), finishedAt: null, error: null }

  // KHÔNG nén (uploads phần lớn là tệp đã nén: PDF/ảnh/zip) → nhanh, đỡ CPU.
  const child = spawn('tar', ['--force-local', '-cf', fwd(out), '-C', fwd(SERVER_DIR), 'uploads'], { shell: false })
  let stderr = ''
  child.stderr.on('data', d => { stderr += d.toString() })
  child.on('error', err => { job = { ...job, state: 'error', finishedAt: Date.now(), error: err.message }; rmrf(out) })
  child.on('close', code => {
    if (code === 0) {
      job = { ...job, state: 'done', finishedAt: Date.now() }
      // Giữ duy nhất bản auto mới nhất: xoá các uploads-*.tar cũ để khỏi đầy đĩa.
      pruneOldAutoBackups(path.basename(out))
    } else {
      job = { ...job, state: 'error', finishedAt: Date.now(), error: `tar mã ${code}: ${stderr.trim().slice(0, 300)}` }
      rmrf(out)
    }
  })
  res.status(202).json({ started: true, file: path.basename(out) })
}

function pruneOldAutoBackups(keep) {
  try {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (/^uploads-.*\.tar$/i.test(f) && f !== keep) rmrf(path.join(BACKUP_DIR, f))
    }
  } catch { /* ignore */ }
}

// GET /api/admin/uploads-backup/status
export function uploadsJobStatus(_req, res) { res.json(jobView()) }

// ── Liệt kê các bản sao đang có trên đĩa VPS: GET /api/admin/uploads-backups ───
export function listUploadsBackups(_req, res) {
  try {
    ensureDir(BACKUP_DIR)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /\.tar$/i.test(f))
      .map(f => { const s = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, size: s.size, mtime: s.mtimeMs } })
      .sort((a, b) => b.mtime - a.mtime)
    res.json({ items: files, dir: BACKUP_DIR })
  } catch (err) {
    console.error('listUploadsBackups:', err)
    res.status(500).json({ error: 'Không đọc được danh sách bản sao uploads.' })
  }
}

// ── Tải 1 bản sao về máy: GET /api/admin/uploads-backups/download?file=NAME ────
// res.download hỗ trợ Range → trình duyệt/trình tải có thể NỐI LẠI khi đứt mạng.
export function downloadUploadsBackup(req, res) {
  const abs = safeBackupFile(req.query.file)
  if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: 'Không tìm thấy tệp sao lưu.' })
  res.download(abs, path.basename(abs))
}

// ── Xoá 1 bản sao để giải phóng đĩa: DELETE /api/admin/uploads-backups?file=NAME
export function deleteUploadsBackup(req, res) {
  const abs = safeBackupFile(req.query.file)
  if (!abs) return res.status(400).json({ error: 'Tên tệp không hợp lệ.' })
  rmrf(abs)
  res.json({ success: true })
}

// ── Khôi phục uploads từ 1 tệp .tar có sẵn trên đĩa VPS: POST /uploads-restore ─
// (Đặt tệp vào BACKUP_DIR bằng scp khi cần, rồi gọi khôi phục — không upload 40GB qua web.)
export function restoreUploads(req, res) {
  if (String(req.body?.confirm || '').trim() !== RESTORE_CONFIRM) {
    return res.status(400).json({ error: `Vui lòng gõ đúng "${RESTORE_CONFIRM}" để xác nhận.` })
  }
  if (job.state === 'running') return res.status(409).json({ error: 'Đang có một tác vụ chạy, vui lòng đợi.' })
  const abs = safeBackupFile(req.body?.file)
  if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: 'Không tìm thấy tệp sao lưu trên máy chủ.' })

  // An toàn kép: đổi tên uploads hiện tại trước khi thay.
  let bak = null
  if (fs.existsSync(UPLOADS_DIR)) {
    bak = path.join(SERVER_DIR, `uploads.bak-${timestamp()}`)
    try { fs.renameSync(UPLOADS_DIR, bak) }
    catch (e) { return res.status(500).json({ error: 'Không tách được uploads hiện tại: ' + e.message }) }
  }
  job = { state: 'running', kind: 'restore', file: path.basename(abs), startedAt: Date.now(), finishedAt: null, error: null }

  // Tệp .tar chứa thư mục gốc "uploads/" → giải nén vào SERVER_DIR tạo lại uploads/.
  const child = spawn('tar', ['--force-local', '-xf', fwd(abs), '-C', fwd(SERVER_DIR)], { shell: false })
  let stderr = ''
  child.stderr.on('data', d => { stderr += d.toString() })
  const fail = msg => {
    // Hoàn nguyên uploads cũ nếu giải nén lỗi.
    if (bak && fs.existsSync(bak) && !fs.existsSync(UPLOADS_DIR)) { try { fs.renameSync(bak, UPLOADS_DIR) } catch { /* */ } }
    job = { ...job, state: 'error', finishedAt: Date.now(), error: msg }
  }
  child.on('error', err => fail(err.message))
  child.on('close', code => {
    if (code === 0 && fs.existsSync(UPLOADS_DIR)) {
      job = { ...job, state: 'done', finishedAt: Date.now() }
      if (bak) rmrf(bak)
      notifyAdminsUploadsRestored(req.user?.id)
    } else {
      fail(`tar mã ${code}: ${stderr.trim().slice(0, 300)}`)
    }
  })
  res.status(202).json({ started: true })
}

async function notifyAdminsUploadsRestored(actorId) {
  try {
    const { rows } = await pool.query("SELECT id FROM app_user WHERE role = '1'")
    const ids = rows.map(r => r.id)
    if (!ids.length) return
    let who = `#${actorId}`
    if (actorId) {
      const { rows: a } = await pool.query('SELECT full_name, email FROM app_user WHERE id = $1', [actorId])
      who = a[0]?.full_name || a[0]?.email || who
    }
    notifyAction(ids, `⚠️ Thư mục tệp đính kèm (uploads) vừa được KHÔI PHỤC từ bản sao lưu bởi ${who}.`)
  } catch (err) { console.error('notifyAdminsUploadsRestored:', err) }
}
