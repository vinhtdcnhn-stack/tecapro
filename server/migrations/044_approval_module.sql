-- 044_approval_module.sql
-- Module "Đề xuất / Phê duyệt" (giống Base Request) — độc lập, toàn công ty.
-- Admin tự cấu hình loại đơn (form builder): tự thêm/bớt trường + chuỗi người duyệt.
-- Đơn đi qua chuỗi duyệt NHIỀU BƯỚC TUẦN TỰ. Chuỗi bước được CHỤP (snapshot) lúc gửi
-- để đổi cấu hình sau không phá đơn đang chạy.
-- Mọi object tiền tố approval_. Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  NHÓM 1 — ĐỊNH NGHĨA (template do admin cấu hình)                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Loại đơn / đề xuất ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_form (
  id          bigserial PRIMARY KEY,
  code        varchar(40)  NOT NULL UNIQUE,           -- 'LEAVE' | 'ADVANCE' | ...
  name        varchar(150) NOT NULL,
  description text,
  icon        varchar(40),                            -- emoji/tên icon hiển thị
  is_active   boolean      DEFAULT true,
  sort_order  integer      DEFAULT 0,
  created_by  integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now()
);

-- ── Trường của form (form builder) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_form_field (
  id          bigserial PRIMARY KEY,
  form_id     bigint       NOT NULL REFERENCES approval_form(id) ON DELETE CASCADE,
  field_key   varchar(60)  NOT NULL,                  -- khóa trong form_data jsonb
  label       varchar(200) NOT NULL,
  field_type  varchar(20)  NOT NULL,                  -- text|textarea|number|money|date|date_range|select|checkbox|user|file
  options     jsonb,                                  -- cho select: ["A","B",...]
  is_required boolean      DEFAULT false,
  sort_order  integer      DEFAULT 0,
  config      jsonb,                                  -- cấu hình thêm (placeholder, min, max…)
  UNIQUE (form_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_aff_form ON approval_form_field(form_id);

-- ── Bước duyệt của form ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_form_step (
  id         bigserial PRIMARY KEY,
  form_id    bigint       NOT NULL REFERENCES approval_form(id) ON DELETE CASCADE,
  step_order integer      NOT NULL,
  name       varchar(150) NOT NULL,
  rule       varchar(10)  NOT NULL DEFAULT 'any',     -- 'any' (1 người duyệt) | 'all' (tất cả)
  UNIQUE (form_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_afs_form ON approval_form_step(form_id);

-- ── Người duyệt cấu hình cho bước ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_form_step_approver (
  id            bigserial PRIMARY KEY,
  step_id       bigint      NOT NULL REFERENCES approval_form_step(id) ON DELETE CASCADE,
  approver_type varchar(20) NOT NULL DEFAULT 'user',  -- 'user' | 'position' | 'department_head'
  approver_ref  varchar(40) NOT NULL                  -- user id | position code | department id
);
CREATE INDEX IF NOT EXISTS idx_afsa_step ON approval_form_step_approver(step_id);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  NHÓM 2 — ĐƠN THỰC TẾ (instance + snapshot chuỗi duyệt)                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Đơn ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_request (
  id           bigserial PRIMARY KEY,
  form_id      bigint       NOT NULL REFERENCES approval_form(id),
  requester_id integer      NOT NULL REFERENCES app_user(id),
  title        varchar(300) NOT NULL,
  status       varchar(20)  NOT NULL DEFAULT 'draft', -- draft|pending|approved|rejected|cancelled
  current_step integer,                               -- step_order của bước đang chờ duyệt
  form_data    jsonb        NOT NULL DEFAULT '{}',    -- giá trị các trường, key = field_key
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_request_requester ON approval_request(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_status    ON approval_request(status);
CREATE INDEX IF NOT EXISTS idx_approval_request_form      ON approval_request(form_id);

-- ── Snapshot bước duyệt của đơn ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_request_step (
  id         bigserial PRIMARY KEY,
  request_id bigint       NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
  step_order integer      NOT NULL,
  name       varchar(150) NOT NULL,
  rule       varchar(10)  NOT NULL DEFAULT 'any',
  status     varchar(12)  NOT NULL DEFAULT 'pending', -- pending|approved|rejected|skipped
  decided_at timestamptz,
  created_at timestamptz  DEFAULT now(),
  UNIQUE (request_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_ars_request ON approval_request_step(request_id);

-- ── Người duyệt của từng bước-instance ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_request_step_approver (
  id          bigserial PRIMARY KEY,
  step_id     bigint      NOT NULL REFERENCES approval_request_step(id) ON DELETE CASCADE,
  approver_id integer     NOT NULL REFERENCES app_user(id),
  decision    varchar(12) NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  comment     text,
  decided_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_arsa_step     ON approval_request_step_approver(step_id);
CREATE INDEX IF NOT EXISTS idx_arsa_approver ON approval_request_step_approver(approver_id, decision);

-- ── Tệp đính kèm của đơn (mirror dept_work_task_attachment) ───────────────────
CREATE TABLE IF NOT EXISTS approval_request_attachment (
  id          bigserial PRIMARY KEY,
  request_id  bigint       NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
  file_name   varchar(255) NOT NULL,
  file_path   varchar(500) NOT NULL,   -- '/uploads/approval-requests/{requestId}/{ts}_{safe}'
  file_size   bigint,
  mime_type   varchar(150),
  uploaded_by integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ara_request ON approval_request_attachment(request_id);

-- ── Timeline / nhật ký sự kiện của đơn ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_request_event (
  id         bigserial PRIMARY KEY,
  request_id bigint      NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
  actor_id   integer     REFERENCES app_user(id),
  event_type varchar(30) NOT NULL,    -- submitted|approved|rejected|cancelled|completed|commented
  detail     jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_are_request ON approval_request_event(request_id);

COMMIT;
