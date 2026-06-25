import { pool } from '../db.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Ghi 1 dòng nhật ký gửi vào telegram_send_log. Fire-and-forget + tự nuốt lỗi:
// logging KHÔNG bao giờ được làm đứt hàng đợi gửi hay luồng nghiệp vụ.
function logSend({ chatId, text, ok, error = null, httpStatus = null }) {
  pool
    .query(
      `INSERT INTO telegram_send_log (chat_id, message, ok, error, http_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [chatId == null ? null : String(chatId), text ?? null, ok, error, httpStatus],
    )
    .catch(err => console.error('telegram_send_log insert error:', err))
}

// Khoảng cách tối thiểu giữa HAI lần gửi liên tiếp: KHÔNG bao giờ gửi đồng loạt.
// Mọi tin nhắn Telegram đi qua một HÀNG ĐỢI TOÀN CỤC và được phát lần lượt, cách
// nhau ít nhất 3 giây — dù là phát cho nhiều người (fan-out) hay nhiều sự kiện
// xảy ra gần nhau. Giảm rủi ro bị Telegram rate-limit / nuốt tin và đảm bảo thông
// báo tới từng người tuần tự.
const SEND_GAP_MS = 3000

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// Hàng đợi gửi: một promise nối đuôi nhau. Mỗi lần gửi chờ cho đủ 3s kể từ lần
// gửi thật trước đó rồi mới gọi API. lastSentAt được cập nhật SAU mỗi lần gửi.
let sendQueue = Promise.resolve()
let lastSentAt = 0

// Gọi API Telegram thật sự (tự nuốt lỗi để không làm đứt hàng đợi).
async function rawSend(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      const error = data?.description || `Telegram trả về lỗi (HTTP ${res.status}).`
      console.error('Telegram sendMessage error:', data || res.status)
      logSend({ chatId, text, ok: false, error, httpStatus: res.status })
    } else {
      logSend({ chatId, text, ok: true, httpStatus: res.status })
    }
  } catch (err) {
    console.error('Telegram fetch error:', err)
    logSend({ chatId, text, ok: false, error: err?.message || 'fetch error' })
  }
}

// Xếp một tin vào hàng đợi gửi. Fire-and-forget: caller KHÔNG cần await — hàng đợi
// tự phát nền, cách nhau ≥3s. Trả về promise hoàn tất khi tin này đã gửi xong
// (hữu ích nếu nơi nào đó muốn await).
export function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) return Promise.resolve()
  sendQueue = sendQueue.then(async () => {
    const wait = lastSentAt + SEND_GAP_MS - Date.now()
    if (wait > 0) await delay(wait)
    await rawSend(chatId, text)
    lastSentAt = Date.now()
  })
  return sendQueue
}

// Gửi CÙNG một text tới nhiều chat id. Chỉ việc xếp tất cả vào hàng đợi — việc giãn
// cách 3s do hàng đợi toàn cục lo, nên không gửi đồng loạt.
export function sendTelegramToMany(chatIds, text) {
  const ids = [...new Set((chatIds || []).filter(Boolean))]
  for (const id of ids) sendTelegramMessage(id, text)
}

// Gửi NGAY tới một chat id và TRẢ VỀ kết quả ({ ok, error }) thay vì nuốt lỗi.
// Không qua hàng đợi giãn cách — dùng cho thao tác kiểm tra thủ công cần phản hồi
// tức thì (vd nút "Gửi thử" trong form người dùng). KHÔNG dùng cho thông báo hàng loạt.
export async function sendTelegramNow(chatId, text) {
  if (!BOT_TOKEN) return { ok: false, error: 'Server chưa cấu hình TELEGRAM_BOT_TOKEN.' }
  if (!chatId) return { ok: false, error: 'Chưa có Telegram Chat ID.' }
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      const error = data?.description || `Telegram trả về lỗi (HTTP ${res.status}).`
      logSend({ chatId, text, ok: false, error, httpStatus: res.status })
      return { ok: false, error }
    }
    logSend({ chatId, text, ok: true, httpStatus: res.status })
    return { ok: true }
  } catch (err) {
    const error = err?.message || 'Không gọi được Telegram API.'
    logSend({ chatId, text, ok: false, error })
    return { ok: false, error }
  }
}
