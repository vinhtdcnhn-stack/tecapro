-- 043_dept_work_module.sql
-- Module "Quản lý công việc — Ban KT Cơ điện" (department id 7).
-- Tách riêng khỏi contract_task: việc của phòng, giao cho nhiều người, có nhóm trưởng,
-- chuyển việc (handoff) cần chấp nhận, đẩy cấp trên (escalation), việc nguồn khách hàng,
-- báo cáo vấn đề, và nhật ký công việc hằng ngày để tính năng lực.
-- Mọi object tiền tố dept_work_. Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Team trong phòng (presale / postsale) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS dept_work_team (
  id            bigserial PRIMARY KEY,
  department_id integer      NOT NULL REFERENCES department(id),
  code          varchar(20)  NOT NULL,            -- 'PRESALE' | 'POSTSALE'
  name          varchar(100) NOT NULL,
  sort_order    integer      DEFAULT 0,
  created_at    timestamptz  DEFAULT now(),
  UNIQUE (department_id, code)
);

-- ── Thành viên + vai trò trong module (HEAD/DEPUTY/MEMBER tường minh, sửa trong app) ──
CREATE TABLE IF NOT EXISTS dept_work_member (
  id            bigserial PRIMARY KEY,
  department_id integer     NOT NULL REFERENCES department(id),
  user_id       integer     NOT NULL REFERENCES app_user(id),
  team_id       bigint      REFERENCES dept_work_team(id),
  dept_role     varchar(10) NOT NULL DEFAULT 'MEMBER',  -- 'HEAD' | 'DEPUTY' | 'MEMBER'
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (department_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dwm_team ON dept_work_member(team_id);
CREATE INDEX IF NOT EXISTS idx_dwm_user ON dept_work_member(user_id);

-- ── Việc (không gắn hợp đồng) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dept_work_task (
  id              bigserial PRIMARY KEY,
  department_id   integer      NOT NULL REFERENCES department(id),
  team_id         bigint       REFERENCES dept_work_team(id),
  title           varchar(500) NOT NULL,
  description     text,
  instructions    text,                                   -- chỉ đạo cấp việc
  priority        varchar(20)  NOT NULL DEFAULT 'Bình thường',
  due_date        date,
  status          varchar(30)  NOT NULL DEFAULT 'Chờ xử lý', -- DUY NHẤT, do nhóm trưởng đổi
  created_by      integer      NOT NULL REFERENCES app_user(id),
  completed_at    timestamptz,
  -- nguồn việc
  origin          varchar(20)  NOT NULL DEFAULT 'internal', -- 'internal' | 'customer'
  customer_name    varchar(255),
  customer_contact varchar(255),
  -- đẩy cấp trên (escalation)
  escalated       boolean      DEFAULT false,
  escalated_by    integer      REFERENCES app_user(id),
  escalated_at    timestamptz,
  escalation_note text,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwt_team      ON dept_work_task(team_id);
CREATE INDEX IF NOT EXISTS idx_dwt_status    ON dept_work_task(status);
CREATE INDEX IF NOT EXISTS idx_dwt_due       ON dept_work_task(due_date);
CREATE INDEX IF NOT EXISTS idx_dwt_escalated ON dept_work_task(escalated);

-- ── Việc ↔ người nhận (n-n) + nhóm trưởng + vòng đời chuyển việc ──────────────
CREATE TABLE IF NOT EXISTS dept_work_assignment (
  id           bigserial PRIMARY KEY,
  task_id      bigint      NOT NULL REFERENCES dept_work_task(id) ON DELETE CASCADE,
  assignee_id  integer     NOT NULL REFERENCES app_user(id),
  assigned_by  integer     NOT NULL REFERENCES app_user(id),
  is_lead      boolean     DEFAULT false,                 -- nhóm trưởng của việc
  instructions text,                                      -- chỉ đạo riêng cho người này
  accept_state varchar(12) NOT NULL DEFAULT 'accepted',   -- 'pending'|'accepted'|'rejected'
  handoff_from integer     REFERENCES app_user(id),
  responded_at timestamptz,
  is_active    boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
-- Mỗi người chỉ có 1 assignment ACTIVE cho mỗi việc (cho phép nhiều dòng lịch sử khi đã inactive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_dwa_task_assignee_active
  ON dept_work_assignment(task_id, assignee_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_dwa_task     ON dept_work_assignment(task_id);
CREATE INDEX IF NOT EXISTS idx_dwa_assignee ON dept_work_assignment(assignee_id);
CREATE INDEX IF NOT EXISTS idx_dwa_accept   ON dept_work_assignment(accept_state);

-- ── Tệp đính kèm của việc (mirror contract_task_attachment) ───────────────────
CREATE TABLE IF NOT EXISTS dept_work_task_attachment (
  id          bigserial PRIMARY KEY,
  task_id     bigint       NOT NULL REFERENCES dept_work_task(id) ON DELETE CASCADE,
  file_name   varchar(255) NOT NULL,
  file_path   varchar(500) NOT NULL,   -- '/uploads/dept-work-tasks/{taskId}/{ts}_{safe}'
  file_size   bigint,
  mime_type   varchar(150),
  uploaded_by integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwta_task ON dept_work_task_attachment(task_id);

-- ── Báo cáo vấn đề khi triển khai ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dept_work_issue (
  id            bigserial PRIMARY KEY,
  task_id       bigint      NOT NULL REFERENCES dept_work_task(id) ON DELETE CASCADE,
  assignment_id bigint      REFERENCES dept_work_assignment(id),
  reported_by   integer     NOT NULL REFERENCES app_user(id),
  content       text        NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'open',      -- 'open' | 'resolved'
  resolved_by   integer     REFERENCES app_user(id),
  resolved_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwi_task   ON dept_work_issue(task_id);
CREATE INDEX IF NOT EXISTS idx_dwi_status ON dept_work_issue(status);

-- ── Nhật ký công việc hằng ngày (đầu vào tính năng lực) ───────────────────────
CREATE TABLE IF NOT EXISTS dept_work_log (
  id           bigserial PRIMARY KEY,
  user_id      integer       NOT NULL REFERENCES app_user(id),
  log_date     date          NOT NULL,
  task_id      bigint        REFERENCES dept_work_task(id),  -- tùy chọn: việc trong module hoặc tự do
  description  text          NOT NULL,
  effort_hours numeric(4,1)  NOT NULL DEFAULT 0,
  created_at   timestamptz   DEFAULT now(),
  updated_at   timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwl_user_date ON dept_work_log(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_dwl_task      ON dept_work_log(task_id);

-- ── Seed: 2 team + thành viên dept 7 ─────────────────────────────────────────
INSERT INTO dept_work_team (department_id, code, name, sort_order) VALUES
  (7, 'PRESALE',  'Presale',  1),
  (7, 'POSTSALE', 'Postsale', 2)
ON CONFLICT (department_id, code) DO NOTHING;

-- id8=HEAD, id9/id18=DEPUTY, id10/id12/id13=MEMBER (team gán sau trong app)
INSERT INTO dept_work_member (department_id, user_id, dept_role) VALUES
  (7, 8,  'HEAD'),
  (7, 9,  'DEPUTY'),
  (7, 18, 'DEPUTY'),
  (7, 10, 'MEMBER'),
  (7, 12, 'MEMBER'),
  (7, 13, 'MEMBER')
ON CONFLICT (department_id, user_id) DO NOTHING;

COMMIT;
