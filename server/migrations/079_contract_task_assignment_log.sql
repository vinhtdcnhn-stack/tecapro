-- Nhật ký giao / chuyển việc của công việc HĐ bán (contract_task).
-- Ghi lại toàn bộ quá trình: giao lần đầu (action='assign', from_user_id NULL) và mỗi
-- lần chuyển việc đổi người thực hiện (action='transfer'). Dùng để hiển thị hint khi
-- di chuột vào tên người thực hiện. Xoá việc → xoá luôn nhật ký (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS public.contract_task_assignment_log (
  id           bigserial PRIMARY KEY,
  task_id      integer NOT NULL REFERENCES public.contract_task(id) ON DELETE CASCADE,
  from_user_id integer REFERENCES public.app_user(id),  -- người thực hiện trước đó (NULL khi giao lần đầu)
  to_user_id   integer REFERENCES public.app_user(id),  -- người được giao mới
  action       varchar(20) NOT NULL DEFAULT 'assign',   -- 'assign' (giao lần đầu) | 'transfer' (chuyển việc)
  actor_id     integer REFERENCES public.app_user(id),  -- người thao tác giao/chuyển
  note         text,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_assign_log_task
  ON public.contract_task_assignment_log(task_id, created_at);
