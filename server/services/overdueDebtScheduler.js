import { pool } from '../db.js'
import { notifyAction } from './notify.js'
import {
  computeReceivableDues, TIER_LABEL, TIER_ROLES, TIER_WITH_BGD,
} from '../utils/receivableDue.js'

// ──────────────────────────────────────────────────────────────────────────────
// Cảnh báo nợ quá hạn leo thang qua Telegram (chạy trong tiến trình Express).
//   • Phân nhóm theo số ngày quá hạn (1-7 / 8-15 / 16-30 / >30) — hạn tính theo
//     TIẾN ĐỘ THỰC (computeReceivableDues basis='actual').
//   • Người nhận theo cấp (TIER_ROLES): vai trò trên HĐ (PM/Sale/Accounting) + BGĐ ở
//     cấp >30 (vị trí GD/PGD toàn hệ thống).
//   • Gửi LẦN 1 ngay khi chạm 1 nhóm mới; LẦN 2+ vào đầu mỗi tuần (thứ 2) tới khi hết
//     nợ. Chống trùng bằng bảng overdue_alert_log.
//
// Cấu hình: TELEGRAM_BOT_TOKEN (bắt buộc), OVERDUE_ALERT_ENABLED ('false' để tắt),
//           OVERDUE_ALERT_TIME (giờ VN, mặc định '08:30').
// ──────────────────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// Thứ 2 của tuần chứa asOf (yyyy-mm-dd) — mốc so sánh "đã gửi trong tuần".
function mondayOf(asOf) {
  const [y, m, d] = asOf.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() === 0 ? 7 : dt.getDay()   // 1..7, T2=1
  dt.setDate(dt.getDate() - (dow - 1))
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
const isMondayVN = (asOf) => { const [y, m, d] = asOf.split('-').map(Number); return new Date(y, m - 1, d).getDay() === 1 }

async function loadReceivables() {
  const { rows } = await pool.query(`
    SELECT r.id, r.contract_out_id, r.description, r.amount, r.currency_code, r.exchange_rate,
           r.due_date, r.due_offset_days, r.due_base_bb_type_id, r.due_base_anchor, r.sort_order,
           c.contract_no, c.project_name, c.contract_date, cu.name AS customer_name,
           COALESCE((SELECT SUM(p.amount) FROM contract_receivable_payment p WHERE p.schedule_id = r.id), 0) AS paid
      FROM contract_receivable r
      JOIN contract_out c ON c.id = r.contract_out_id AND COALESCE(c.is_deleted, false) = false
      LEFT JOIN customer cu ON cu.id = c.customer_id
     ORDER BY c.id, r.sort_order, r.id`)
  return rows
}
async function loadProgressByContract() {
  const { rows } = await pool.query(`
    SELECT contract_out_id, id, bb_type_id, planned_date, actual_date, offset_days, base_bb_type_id, base_anchor
      FROM contract_out_progress ORDER BY contract_out_id, sort_order, id`)
  const map = new Map()
  for (const r of rows) {
    const k = String(r.contract_out_id)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
}

// Quét 1 lượt và gửi cảnh báo. Trả về { sent, recipients } để test/log.
export async function runOverdueAlerts(asOf = null, { dryRun = false } = {}) {
  const today = asOf || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const [receivables, progressByContract] = await Promise.all([loadReceivables(), loadProgressByContract()])
  const overdue = computeReceivableDues(receivables, progressByContract, 'actual', today)
    .filter(r => r.remaining > 0 && r.tier)

  if (!overdue.length) return { sent: 0, recipients: 0 }

  // Nhật ký đã gửi của các khoản liên quan.
  const recvIds = overdue.map(r => Number(r.id))
  const { rows: logs } = await pool.query(
    'SELECT receivable_id, tier, to_char(sent_on, \'YYYY-MM-DD\') AS sent_on FROM overdue_alert_log WHERE receivable_id = ANY($1)',
    [recvIds])
  const logsByRecv = new Map()
  for (const l of logs) {
    const k = String(l.receivable_id)
    if (!logsByRecv.has(k)) logsByRecv.set(k, [])
    logsByRecv.get(k).push(l)
  }

  const weekStart = mondayOf(today)
  const monday = isMondayVN(today)
  const toSend = overdue.filter(r => {
    const ls = logsByRecv.get(String(r.id)) || []
    const sentThisTier = ls.some(l => l.tier === r.tier)
    const sentThisWeek = ls.some(l => l.sent_on >= weekStart)
    return !sentThisTier || (monday && !sentThisWeek)   // lần 1 khi chạm nhóm mới · lần 2 đầu tuần
  })
  if (!toSend.length) return { sent: 0, recipients: 0 }

  // Người nhận: thành viên HĐ theo vai trò + BGĐ (cho cấp >30).
  const contractIds = [...new Set(toSend.map(r => Number(r.contract_out_id)))]
  const allRoles = [...new Set(Object.values(TIER_ROLES).flat())]
  const { rows: memberRows } = await pool.query(
    'SELECT contract_out_id, user_id, member_role FROM contract_out_member WHERE contract_out_id = ANY($1) AND member_role = ANY($2)',
    [contractIds, allRoles])
  const membersByContract = new Map()
  for (const m of memberRows) {
    const k = String(m.contract_out_id)
    if (!membersByContract.has(k)) membersByContract.set(k, [])
    membersByContract.get(k).push(m)
  }
  let bgdIds = []
  if (toSend.some(r => TIER_WITH_BGD.has(r.tier))) {
    const { rows } = await pool.query(`
      SELECT DISTINCT u.id FROM app_user u
        LEFT JOIN app_user_position aup ON aup.user_id = u.id
        LEFT JOIN "position" p  ON p.id  = aup.position_id
        LEFT JOIN "position" p0 ON p0.id = u.position_id
       WHERE p.code IN ('GD','PGD') OR p0.code IN ('GD','PGD')`)
    bgdIds = rows.map(r => Number(r.id))
  }

  // Gom dòng theo từng user (1 tin/nhiều khoản).
  const byUser = new Map()
  const fmtMoney = (n) => (parseFloat(n) || 0).toLocaleString('vi-VN')
  for (const r of toSend) {
    const roles = TIER_ROLES[r.tier] || []
    const members = (membersByContract.get(String(r.contract_out_id)) || []).filter(m => roles.includes(m.member_role))
    const recips = new Set(members.map(m => Number(m.user_id)))
    if (TIER_WITH_BGD.has(r.tier)) bgdIds.forEach(id => recips.add(id))
    const label = r.contract_no || r.project_name || `#${r.contract_out_id}`
    const desc = r.description ? `${r.description} — ` : ''
    const line = `• HĐ ${label}${r.customer_name ? ` (${r.customer_name})` : ''}: ${desc}còn nợ ${fmtMoney(r.remaining)} ${r.currency_code} — ${TIER_LABEL[r.tier]} (quá hạn ${r.days_overdue} ngày, hạn ${r.effective_due ? fmtDate(r.effective_due) : '—'})`
    for (const uid of recips) {
      if (!uid) continue
      if (!byUser.has(uid)) byUser.set(uid, [])
      byUser.get(uid).push(line)
    }
  }

  if (!dryRun) {
    for (const [uid, lines] of byUser) {
      notifyAction([uid], `Cảnh báo công nợ quá hạn cần xử lý:\n${lines.join('\n')}`)
    }
    // Ghi nhật ký đã gửi.
    const values = toSend.map((r, i) => `($${i * 2 + 1}, $${i * 2 + 2}, '${today}')`).join(',')
    const params = toSend.flatMap(r => [Number(r.id), r.tier])
    if (values) await pool.query(
      `INSERT INTO overdue_alert_log (receivable_id, tier, sent_on) VALUES ${values}`, params)
  }

  return { sent: toSend.length, recipients: byUser.size }
}

function vnNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const o = {}; for (const p of parts) o[p.type] = p.value
  const hour = o.hour === '24' ? '00' : o.hour
  return { date: `${o.year}-${o.month}-${o.day}`, hhmm: `${hour}:${o.minute}` }
}

// Lập lịch: kiểm tra mỗi phút, chạy 1 lần/ngày vào OVERDUE_ALERT_TIME (giờ VN), T2→T6.
export function startOverdueAlertScheduler() {
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.OVERDUE_ALERT_ENABLED === 'false') return
  const time = (process.env.OVERDUE_ALERT_TIME || '08:30').trim()
  let lastFired = null
  const tick = () => {
    const { date, hhmm } = vnNow()
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (dow < 1 || dow > 5) return    // T2→T6
    const key = `${date} ${hhmm}`
    if (hhmm === time && lastFired !== key) {
      lastFired = key
      runOverdueAlerts().catch(err => console.error('runOverdueAlerts:', err))
    }
  }
  setInterval(tick, 60 * 1000)
  console.log(`[overdue-alert] đã bật — cảnh báo nợ lúc ${time} (giờ VN), T2→T6`)
}
