import { pool } from '../db.js'
import { sendTelegramToMany } from './telegram.js'

// ──────────────────────────────────────────────────────────────────────────────
// Dịch vụ thông báo Telegram dùng chung cho toàn app.
//
// Quy ước thông điệp (theo yêu cầu nghiệp vụ):
//   • notifyAction → sự kiện CẦN người nhận xử lý  → in đậm + chuông 🔔
//   • notifyInfo   → chỉ để nắm bắt thông tin       → chữ thường
//
// Người chưa đăng ký telegram_chat_id sẽ KHÔNG nhận thông báo (bị lọc ở SQL).
// Mọi hàm fire-and-forget: gọi KHÔNG cần await trong controller, tự nuốt lỗi để
// không ảnh hưởng luồng nghiệp vụ.
//
// LƯU Ý: text truyền vào notifyAction/notifyInfo là CHUỖI THUẦN (có thể chứa \n),
// KHÔNG chèn thẻ HTML — các hàm này tự escape và tự bọc <b> khi cần.
// ──────────────────────────────────────────────────────────────────────────────

// Escape các ký tự đặc biệt của parse_mode=HTML để tên/tiêu đề chứa & < > không
// làm Telegram từ chối cả thông điệp.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Lấy danh sách chat id cho các user (bỏ qua người không có telegram_chat_id).
export async function chatIdsForUsers(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))]
  if (!ids.length) return []
  const { rows } = await pool.query(
    'SELECT telegram_chat_id FROM app_user WHERE id = ANY($1) AND telegram_chat_id IS NOT NULL',
    [ids],
  )
  return rows.map(r => r.telegram_chat_id).filter(Boolean)
}

// Gửi text THÔ (đã tự lo HTML) tới danh sách user. Dùng cho thông điệp đã có sẵn
// định dạng riêng (vd module công việc phòng). Code mới nên dùng notifyAction/Info.
// Phát cho từng người LẦN LƯỢT cách nhau 3s (không gửi đồng loạt) qua sendTelegramToMany.
export async function notifyUsers(userIds, text) {
  try {
    await sendTelegramToMany(await chatIdsForUsers(userIds), text)
  } catch (err) {
    console.error('notifyUsers:', err)
  }
}

// Định dạng 1 thông điệp "cần xử lý" (🔔 + in đậm, đã escape) — dùng cho kênh gửi
// raw như notifyHeads. Code thường nên dùng notifyAction.
export function actionText(text) {
  return `🔔 <b>${esc(text)}</b>`
}

// Sự kiện cần người nhận xử lý: in đậm toàn dòng + chuông.
export function notifyAction(userIds, text) {
  return notifyUsers(userIds, actionText(text))
}

// Sự kiện chỉ để nắm thông tin: chữ thường.
export function notifyInfo(userIds, text) {
  return notifyUsers(userIds, esc(text))
}

// ── Helper tra cứu ngữ cảnh ───────────────────────────────────────────────────

// Nhãn hợp đồng để chèn vào thông báo (ưu tiên số HĐ, rồi tên dự án).
export async function contractLabel(contractId) {
  try {
    const { rows } = await pool.query(
      'SELECT contract_no, project_name FROM contract_out WHERE id = $1',
      [contractId],
    )
    if (!rows[0]) return `#${contractId}`
    return rows[0].contract_no || rows[0].project_name || `#${contractId}`
  } catch {
    return `#${contractId}`
  }
}

// Tên người dùng để xưng trong thông báo ("X đã xác nhận..."). '' nếu không tra được.
export async function userFullName(userId) {
  try {
    const { rows } = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [userId])
    return rows[0]?.full_name || ''
  } catch {
    return ''
  }
}

// Id các PM (chủ trì + đồng PM) của một hợp đồng.
export async function pmUserIds(contractId) {
  try {
    const { rows } = await pool.query(
      "SELECT user_id FROM contract_out_member WHERE contract_out_id = $1 AND member_role = 'PM'",
      [contractId],
    )
    return rows.map(r => Number(r.user_id)).filter(Boolean)
  } catch {
    return []
  }
}

// Định dạng ngày (Date hoặc 'YYYY-MM-DD') → dd/mm/yyyy. '' nếu rỗng.
export function fmtDate(d) {
  if (!d) return ''
  const s = typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)
  const [y, m, day] = s.split('-')
  return day && m && y ? `${day}/${m}/${y}` : s
}
