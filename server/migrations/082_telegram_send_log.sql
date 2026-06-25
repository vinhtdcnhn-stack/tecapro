-- Nhật ký mỗi lần gọi API Telegram sendMessage: lưu lại để tra cứu xem tin nhắn
-- có gửi thành công không. Ghi cho CẢ luồng hàng đợi (notifyAction/Info) lẫn
-- "Gửi thử" (sendTelegramNow). Mỗi lần gửi (kể cả fan-out tới nhiều người) là 1 dòng.
CREATE TABLE IF NOT EXISTS public.telegram_send_log (
  id          bigserial PRIMARY KEY,
  chat_id     text,
  message     text,
  ok          boolean NOT NULL,
  error       text,                          -- mô tả lỗi khi ok=false (NULL nếu thành công)
  http_status integer,                       -- mã HTTP Telegram trả về (NULL nếu fetch ném lỗi)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tra cứu gần đây / lọc theo người nhận.
CREATE INDEX IF NOT EXISTS idx_telegram_send_log_created_at ON public.telegram_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_send_log_chat_id ON public.telegram_send_log (chat_id);
