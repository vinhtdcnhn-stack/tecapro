// Bộ lọc loại file cho multer: chặn các định dạng thực thi/script nguy hiểm.
// Tài liệu hợp pháp (office, pdf, ảnh, nén, text) vẫn được chấp nhận.

const BLOCKED_EXT = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.sh', '.bash', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.mjs', '.cjs',
  '.jar', '.app', '.dll', '.so', '.dylib',
  '.html', '.htm', '.xhtml', '.svg', // có thể nhúng script → XSS khi mở
  '.php', '.phtml', '.asp', '.aspx', '.jsp',
])

// Null byte & ký tự điều khiển U+0000–U+001F trong tên file (phòng vệ thêm cho việc lưu/đặt tên).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f]/

export function safeUploadFilter(req, file, cb) {
  const name = String(file.originalname || '')
  if (CONTROL_CHARS.test(name)) {
    cb(new Error('Tên tệp không hợp lệ.'))
    return
  }
  const dot = name.lastIndexOf('.')
  const ext = dot === -1 ? '' : name.slice(dot).toLowerCase()
  if (BLOCKED_EXT.has(ext)) {
    cb(new Error(`Định dạng tệp không được phép: ${ext}`))
    return
  }
  cb(null, true)
}

export const UPLOAD_LIMITS = { fileSize: 50 * 1024 * 1024 } // 50 MB
