-- 064_tender_module.sql
-- Module "Quản lý Đấu thầu — Ban Kế hoạch Đấu thầu" (department id 9).
-- GĐ1 — Nền tảng: thành viên phòng, gói thầu (16 trường + trạng thái workflow), nhật ký audit.
-- Mẫu giống dept_work (043). Mọi object tiền tố tender_. Áp bằng tay qua psql (local + VPS).
-- KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Thành viên + vai trò trong module (HEAD = Trưởng phòng, MEMBER = nhân viên làm thầu) ──
CREATE TABLE IF NOT EXISTS tender_member (
  id            bigserial PRIMARY KEY,
  department_id integer     NOT NULL REFERENCES department(id),
  user_id       integer     NOT NULL REFERENCES app_user(id),
  dept_role     varchar(10) NOT NULL DEFAULT 'MEMBER',  -- 'HEAD' | 'MEMBER'
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (department_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_user ON tender_member(user_id);

-- ── Gói thầu (16 trường của bảng theo dõi Excel + trạng thái workflow) ────────
CREATE TABLE IF NOT EXISTS tender (
  id              bigserial PRIMARY KEY,
  package_name    varchar(500) NOT NULL,                  -- B: Tên gói thầu
  package_code    varchar(100),                           -- C: Mã gói thầu
  investor        varchar(500),                           -- D: Chủ đầu tư
  estimate        numeric(20,2),                          -- E: Dự toán (VND)
  submit_date     date,                                   -- F: Ngày nộp (cảnh báo hạn)
  field           varchar(50),                            -- G: Lĩnh vực (Hạ tầng | CNTT)
  guarantee       varchar(255),                           -- H: Bảo lãnh
  pakd_no         varchar(100),                           -- I: Số PAKD
  uq_no           varchar(100),                           -- J: Số UQ
  assign_decision varchar(255),                           -- K: QĐ giao nhiệm vụ
  bid_maker_id    integer REFERENCES app_user(id),        -- L: Người làm thầu (HR)
  am_id           integer REFERENCES app_user(id),        -- M: AM phụ trách (HR)
  note            text,                                   -- O: Ghi chú
  result          varchar(20),                            -- P: Trúng | Trượt | Hủy | null
  -- N: Tình trạng → trạng thái workflow nội bộ
  workflow_status varchar(30)  NOT NULL DEFAULT 'Khởi tạo',
  -- 'Khởi tạo'|'Đã phân công'|'Lập checklist'|'Đang thực hiện'|'Tổng hợp'
  -- |'Chờ review'|'Đạt'|'Chưa đạt'|'Sẵn sàng in/ký'|'Có kết quả'
  created_by      integer NOT NULL REFERENCES app_user(id),
  is_deleted      boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tender_status    ON tender(workflow_status);
CREATE INDEX IF NOT EXISTS idx_tender_submit    ON tender(submit_date);
CREATE INDEX IF NOT EXISTS idx_tender_bid_maker ON tender(bid_maker_id);
CREATE INDEX IF NOT EXISTS idx_tender_am        ON tender(am_id);
CREATE INDEX IF NOT EXISTS idx_tender_deleted   ON tender(is_deleted);

-- ── Nhật ký thao tác (audit trail) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_activity_log (
  id          bigserial PRIMARY KEY,
  tender_id   bigint      NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  user_id     integer     REFERENCES app_user(id),
  action      varchar(50) NOT NULL,                       -- 'create'|'assign'|'status'|'update'...
  detail      text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tal_tender ON tender_activity_log(tender_id);

-- ── Seed: thành viên ban (dept 9): id32 Đoàn Minh Chung = HEAD, id33 Phí Hải Hà = MEMBER ──
INSERT INTO tender_member (department_id, user_id, dept_role) VALUES
  (9, 32, 'HEAD'),
  (9, 33, 'MEMBER')
ON CONFLICT (department_id, user_id) DO NOTHING;

COMMIT;
