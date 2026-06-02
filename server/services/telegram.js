const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) return

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
