import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { pool } from '../db.js'
import { notifyAction } from '../services/notify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '..')
const UPLOADS_DIR = path.join(SERVER_DIR, 'uploads')

// Dấu nhận dạng bản backup của chính hệ thống này — chặn việc khôi phục nhầm
// một file backup của hệ thống/khách khác đè lên dữ liệu hiện tại.
const APP_ID = 'tecapro-hello-world'
const MANIFEST_VERSION = 1
// Cụm người dùng phải gõ đúng ở ô xác nhận trước khi khôi phục (thao tác phá huỷ).
const RESTORE_CONFIRM = 'KHÔI PHỤC'

// ── Tiện ích chung ────────────────────────────────────────────────────────────

// Chạy 1 lệnh con (pg_dump / pg_restore / tar), trả Promise. shell:false để đường
// dẫn chứa khoảng trắng ("Hello world") và DATABASE_URL không bị shell tách/diễn giải.
function run(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false })
    let stderr = ''
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`Không tìm thấy lệnh "${cmd}". Cần cài PostgreSQL client (pg_dump/pg_restore) và tar trên máy chủ.`))
      } else reject(err)
    })
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} kết thúc với mã ${code}: ${stderr.trim().slice(0, 500)}`))
    })
    if (input !== undefined) { child.stdin.write(input); child.stdin.end() }
  })
}

// GNU tar (msys2) trên Windows hiểu sai đường dẫn dùng dấu "\" và ổ "C:" (coi là host
// từ xa). Chuyển sang "/" cho mọi tham số đường dẫn truyền vào tar (Linux cũng chấp nhận).
const fwd = p => p.replace(/\\/g, '/')

function dbUrl() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Chưa cấu hình DATABASE_URL.')
  return url
}

function dbName() {
  try { return decodeURIComponent(new URL(dbUrl()).pathname.replace(/^\//, '')) || '' }
  catch { return '' }
}

function timestamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }) } catch { /* ignore */ } }

// Đếm nhanh vài bảng chính để ghi vào manifest (giúp đối chiếu khi khôi phục). Không
// chặn backup nếu lỗi.
async function quickCounts() {
  const counts = {}
  for (const t of ['app_user', 'customer', 'contract_out']) {
    try { const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${t}`); counts[t] = rows[0].n }
    catch { /* bảng có thể chưa tồn tại */ }
  }
  return counts
}

// ── Backup: GET /api/admin/backup ─────────────────────────────────────────────
// Tạo 1 file .tgz gồm db.dump (pg_dump custom format) + thư mục uploads + manifest.json,
// rồi stream về cho admin tải xuống. Toàn bộ làm trong thư mục tạm và dọn sau khi gửi.
export async function createBackup(req, res) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tcp-backup-'))
  const dumpPath = path.join(work, 'db.dump')
  const manifestPath = path.join(work, 'manifest.json')
  const archivePath = path.join(os.tmpdir(), `tecapro-backup-${timestamp()}.tgz`)
  const cleanup = () => { rmrf(work); rmrf(archivePath) }
  try {
    // 1) Dump CSDL ở định dạng custom (nén sẵn, cho phép pg_restore --clean).
    await run('pg_dump', ['-Fc', '--no-owner', '--no-acl', '-f', dumpPath, '-d', dbUrl()])

    // 2) Manifest nhận dạng.
    const manifest = {
      app: APP_ID,
      manifest_version: MANIFEST_VERSION,
      created_at: new Date().toISOString(),
      created_by: req.user?.id ?? null,
      db_name: dbName(),
      hostname: os.hostname(),
      counts: await quickCounts(),
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    // 3) Gói lại. uploads có thể chưa tồn tại → tạo rỗng để tar không lỗi.
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    // --force-local: trên Windows đường dẫn "C:\..." có dấu ":" sẽ bị GNU tar hiểu là host từ xa.
    await run('tar', [
      '--force-local', '-czf', fwd(archivePath),
      '-C', fwd(work), 'db.dump', 'manifest.json',
      '-C', fwd(SERVER_DIR), 'uploads',
    ])

    // 4) Stream về client. res.download tự đặt Content-Disposition (tên tệp tải về).
    res.download(archivePath, path.basename(archivePath), err => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Không gửi được tệp backup.' })
      cleanup()
    })
  } catch (err) {
    cleanup()
    console.error('createBackup:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Không tạo được bản backup.' })
  }
}

// ── Restore: POST /api/admin/restore (field 'backup') ─────────────────────────
// Multer lưu file upload vào thư mục tạm. Giới hạn 2GB (uploads có thể rất lớn).
export const uploadRestore = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) { cb(null, os.tmpdir()) },
    filename(_req, _file, cb) { cb(null, `tcp-restore-${Date.now()}.tgz`) },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
}).single('backup')

export async function restoreBackup(req, res) {
  // Xác nhận bằng cụm gõ tay (thao tác ghi đè toàn bộ dữ liệu).
  if (String(req.body?.confirm || '').trim() !== RESTORE_CONFIRM) {
    if (req.file) rmrf(req.file.path)
    return res.status(400).json({ error: `Vui lòng gõ đúng "${RESTORE_CONFIRM}" để xác nhận khôi phục.` })
  }
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn tệp backup.' })

  const archive = req.file.path
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tcp-restore-'))
  const cleanup = () => { rmrf(archive); rmrf(work) }
  let uploadsBak = null
  try {
    // 1) Giải nén.
    await run('tar', ['--force-local', '-xzf', fwd(archive), '-C', fwd(work)])

    // 2) Kiểm tra manifest — chặn file lạ / không đúng định dạng.
    const manifestPath = path.join(work, 'manifest.json')
    const dumpPath = path.join(work, 'db.dump')
    if (!fs.existsSync(manifestPath) || !fs.existsSync(dumpPath)) {
      throw new Error('Tệp backup không hợp lệ (thiếu manifest.json hoặc db.dump).')
    }
    let manifest
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) }
    catch { throw new Error('Không đọc được manifest trong tệp backup.') }
    if (manifest.app !== APP_ID) {
      throw new Error('Tệp backup không thuộc hệ thống này — từ chối khôi phục.')
    }

    // 3) An toàn kép: sao lưu hiện trạng uploads (đổi tên) trước khi ghi đè.
    if (fs.existsSync(UPLOADS_DIR)) {
      uploadsBak = path.join(SERVER_DIR, `uploads.bak-${timestamp()}`)
      fs.renameSync(UPLOADS_DIR, uploadsBak)
    }

    // 4) Khôi phục CSDL: --clean --if-exists để xoá & nạp lại sạch trên DB hiện có.
    await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', '-d', dbUrl(), dumpPath])

    // 5) Thay thư mục uploads bằng bản trong backup (nếu có).
    const srcUploads = path.join(work, 'uploads')
    if (fs.existsSync(srcUploads)) fs.renameSync(srcUploads, UPLOADS_DIR)
    else fs.mkdirSync(UPLOADS_DIR, { recursive: true })

    // 6) Báo Telegram cho admin + dọn bản uploads cũ (đã khôi phục xong).
    notifyAdminsRestored(req.user?.id)
    if (uploadsBak) rmrf(uploadsBak)
    cleanup()
    res.json({ success: true, restored_at: manifest.created_at, counts: manifest.counts || {} })
  } catch (err) {
    // Hoàn nguyên uploads nếu đã đổi tên mà chưa thay xong.
    if (uploadsBak && fs.existsSync(uploadsBak) && !fs.existsSync(UPLOADS_DIR)) {
      try { fs.renameSync(uploadsBak, UPLOADS_DIR) } catch { /* ignore */ }
    }
    cleanup()
    console.error('restoreBackup:', err)
    res.status(500).json({ error: err.message || 'Không khôi phục được hệ thống.' })
  }
}

async function notifyAdminsRestored(actorId) {
  try {
    const { rows } = await pool.query("SELECT id FROM app_user WHERE role = '1'")
    const ids = rows.map(r => r.id)
    if (!ids.length) return
    let who = `#${actorId}`
    if (actorId) {
      const { rows: a } = await pool.query('SELECT full_name, email FROM app_user WHERE id = $1', [actorId])
      who = a[0]?.full_name || a[0]?.email || who
    }
    notifyAction(ids, `⚠️ Hệ thống vừa được KHÔI PHỤC từ bản backup bởi ${who}. Toàn bộ dữ liệu đã được nạp lại từ bản sao lưu.`)
  } catch (err) {
    console.error('notifyAdminsRestored:', err)
  }
}
