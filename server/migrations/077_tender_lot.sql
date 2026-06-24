-- 077_tender_lot.sql
-- Module Đấu thầu — Lô/phần của gói thầu + nhà thầu dự thầu (xếp hạng giá theo lô).
--   • tender_lot   : mỗi gói chia thành 1..n lô; mỗi lô có dự toán + kết quả Trúng/Trượt riêng.
--                    Gói không chia lô → 1 lô mặc định "Toàn gói".
--   • tender_bidder: các đơn vị nộp thầu trong TỪNG lô (tên + giá dự thầu + cờ "của tôi"
--                    + kết quả kỹ thuật). Xếp hạng giá tính lúc đọc (không lưu cột rank).
-- Tiền tệ: dùng tender.currency_code/exchange_rate; giá lưu NGUYÊN TỆ của gói (quy đổi VND
-- chỉ để hiển thị). Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Lô/phần của gói thầu ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_lot (
  id         bigserial PRIMARY KEY,
  tender_id  bigint       NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  lot_name   varchar(500) NOT NULL,         -- Tên lô (gói không chia → "Toàn gói")
  lot_code   varchar(100),                  -- Mã lô (tuỳ chọn)
  estimate   numeric(20,2),                 -- Dự toán lô (nguyên tệ của gói)
  result     varchar(20),                   -- 'Trúng' | 'Trượt' | 'Hủy' | null
  sort_order integer      NOT NULL DEFAULT 0,
  note       text,
  created_at timestamptz  DEFAULT now(),
  updated_at timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tender_lot_tender ON tender_lot(tender_id);

-- ── Nhà thầu dự thầu, gắn theo LÔ ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_bidder (
  id          bigserial PRIMARY KEY,
  lot_id      bigint       NOT NULL REFERENCES tender_lot(id) ON DELETE CASCADE,
  bidder_name varchar(500) NOT NULL,
  bid_price   numeric(20,2),                -- Giá dự thầu (nguyên tệ của gói)
  is_self     boolean      NOT NULL DEFAULT false,
  tech_result varchar(20),                  -- 'Đạt' | 'Trượt' | null
  note        text,
  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tender_bidder_lot ON tender_bidder(lot_id);
-- Tối đa 1 đơn vị "của tôi" mỗi lô.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_bidder_self
  ON tender_bidder(lot_id) WHERE is_self;

COMMIT;
