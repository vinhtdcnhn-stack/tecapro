import { pool } from '../db.js'
import { notifyAction, fmtDate } from './notify.js'

// ──────────────────────────────────────────────────────────────────────────────
// Nhắc hạn hàng ngày qua Telegram (chạy trong tiến trình Express, không thêm thư viện):
//   • Công việc hợp đồng đến hạn / quá hạn  → nhắc người phụ trách.
//   • Công nợ phải thu đến hạn / quá hạn     → nhắc PM hợp đồng (nếu còn nợ).
// Cả hai đều là việc CẦN xử lý → dùng notifyAction (🔔 in đậm).
//
// Lịch chạy: 08:15 và 13:45 GIỜ VIỆT NAM, thứ 2 → thứ 6 (đúng theo Asia/Ho_Chi_Minh,
// không phụ thuộc múi giờ máy chủ).
//
// Cấu hình:
//   TELEGRAM_BOT_TOKEN  — bắt buộc, không có token thì không lập lịch.
//   REMINDER_ENABLED    — đặt 'false' để tắt.
//   REMINDER_TIMES      — danh sách giờ VN, vd "08:15,13:45" (mặc định đó).
// ──────────────────────────────────────────────────────────────────────────────

// Gom nhiều dòng theo từng user rồi gửi 1 tin nhắn (tránh spam khi 1 người nhiều việc).
function pushLine(map, userId, line) {
  if (!userId) return
  if (!map.has(userId)) map.set(userId, [])
  map.get(userId).push(line)
}

// Công việc hợp đồng đến hạn / quá hạn → người phụ trách.
async function remindDueTasks() {
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.assigned_to, t.due_date, c.contract_no, c.project_name
       FROM contract_task t
       JOIN contract_out c ON c.id = t.contract_out_id
      WHERE t.assigned_to IS NOT NULL
        AND t.due_date IS NOT NULL
        AND t.status <> 'Hoàn thành'
        AND t.due_date <= CURRENT_DATE`,
  )
  const byUser = new Map()
  for (const r of rows) {
    const label = r.contract_no || r.project_name || `#${r.id}`
    const overdue = r.due_date < new Date(new Date().toISOString().slice(0, 10))
    const trang = overdue ? 'QUÁ HẠN' : 'đến hạn hôm nay'
    pushLine(byUser, Number(r.assigned_to), `• "${r.title}" (HĐ ${label}) — ${trang} ${fmtDate(r.due_date)}`)
  }
  for (const [userId, lines] of byUser) {
    notifyAction([userId], `Bạn có công việc cần xử lý:\n${lines.join('\n')}`)
  }
}

// Công nợ phải thu đến hạn / quá hạn → PM hợp đồng. Chỉ nhắc nếu hợp đồng còn nợ
// (tổng lịch phải thu > tổng đã thu, so trên số nguyên tệ cùng loại tiền của HĐ).
async function remindDueReceivables() {
  const { rows } = await pool.query(
    `SELECT r.id, r.description, r.amount, r.currency_code, r.due_date,
            r.contract_out_id, c.contract_no, c.project_name
       FROM contract_receivable r
       JOIN contract_out c ON c.id = r.contract_out_id
      WHERE r.due_date IS NOT NULL
        AND r.due_date BETWEEN CURRENT_DATE - INTERVAL '14 days' AND CURRENT_DATE + INTERVAL '3 days'
        AND (SELECT COALESCE(SUM(amount),0) FROM contract_receivable  WHERE contract_out_id = r.contract_out_id)
          > (SELECT COALESCE(SUM(amount),0) FROM contract_receivable_payment WHERE contract_out_id = r.contract_out_id)`,
  )
  if (!rows.length) return

  // Lấy PM cho tất cả hợp đồng liên quan trong 1 truy vấn.
  const contractIds = [...new Set(rows.map(r => Number(r.contract_out_id)))]
  const { rows: pmRows } = await pool.query(
    "SELECT contract_out_id, user_id FROM contract_out_member WHERE contract_out_id = ANY($1) AND member_role = 'PM'",
    [contractIds],
  )
  const pmByContract = new Map()
  for (const p of pmRows) {
    const cid = Number(p.contract_out_id)
    if (!pmByContract.has(cid)) pmByContract.set(cid, [])
    pmByContract.get(cid).push(Number(p.user_id))
  }

  const byUser = new Map()
  for (const r of rows) {
    const label = r.contract_no || r.project_name || `#${r.contract_out_id}`
    const amt = (parseFloat(r.amount) || 0).toLocaleString('vi-VN')
    const desc = r.description ? `${r.description} — ` : ''
    const line = `• HĐ ${label}: ${desc}${amt} ${r.currency_code} (hạn ${fmtDate(r.due_date)})`
    for (const pm of pmByContract.get(Number(r.contract_out_id)) || []) pushLine(byUser, pm, line)
  }
  for (const [userId, lines] of byUser) {
    notifyAction([userId], `Công nợ cần theo dõi thu:\n${lines.join('\n')}`)
  }
}

// Chạy 1 lượt quét nhắc hạn (có thể gọi thủ công để test).
export async function runDailyReminders() {
  try { await remindDueTasks() } catch (err) { console.error('remindDueTasks:', err) }
  try { await remindDueReceivables() } catch (err) { console.error('remindDueReceivables:', err) }
}

// Lấy thời điểm hiện tại theo giờ Việt Nam → { date:'YYYY-MM-DD', hhmm:'HH:MM', dow:1..7 }.
// dow: 1=thứ 2 … 7=Chủ nhật.
function vnNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date())
  const o = {}
  for (const p of parts) o[p.type] = p.value
  const dowMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  let hour = o.hour === '24' ? '00' : o.hour // en-CA hour12:false có thể trả '24' lúc nửa đêm
  return { date: `${o.year}-${o.month}-${o.day}`, hhmm: `${hour}:${o.minute}`, dow: dowMap[o.weekday] }
}

// Khởi động bộ lập lịch: kiểm tra mỗi phút, chạy đúng 1 lần cho mỗi khung giờ/ngày,
// chỉ thứ 2 → thứ 6, theo giờ Việt Nam.
export function startReminderScheduler() {
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.REMINDER_ENABLED === 'false') return
  const times = (process.env.REMINDER_TIMES || '08:15,13:45')
    .split(',').map(s => s.trim()).filter(Boolean)
  let lastFired = null // khóa "YYYY-MM-DD HH:MM" để không chạy lặp trong cùng 1 phút

  const tick = () => {
    const { date, hhmm, dow } = vnNow()
    if (dow < 1 || dow > 5) return // chỉ thứ 2 → thứ 6
    const key = `${date} ${hhmm}`
    if (times.includes(hhmm) && lastFired !== key) {
      lastFired = key
      runDailyReminders()
    }
  }
  setInterval(tick, 60 * 1000)
  tick()
  console.log(`[reminder] đã bật — nhắc hạn lúc ${times.join(', ')} (giờ VN), thứ 2→6`)
}
