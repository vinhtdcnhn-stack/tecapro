const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

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
    if (!res.ok) {
      const err = await res.json()
      console.error('Telegram sendMessage error:', err)
    }
  } catch (err) {
    console.error('Telegram fetch error:', err)
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
