-- Ghim & hẹn nhắc cho dashboard PM ở trang chủ.
-- Mỗi user có thể ghim / đặt ngày nhắc cho từng mốc việc (biên bản/công nợ/bảo lãnh/task).
CREATE TABLE IF NOT EXISTS public.pm_dashboard_tracking (
  id          serial PRIMARY KEY,
  user_id     integer       NOT NULL,
  source_type varchar(20)   NOT NULL,   -- 'progress' | 'receivable' | 'guarantee' | 'task'
  source_id   integer       NOT NULL,
  pinned      boolean       DEFAULT false,
  remind_at   date,                      -- null = mặc định (hạn − 7 ngày)
  updated_at  timestamptz   DEFAULT now(),
  UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_track_user ON public.pm_dashboard_tracking(user_id);
