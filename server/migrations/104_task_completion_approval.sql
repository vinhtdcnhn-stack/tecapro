-- 104: Xác nhận hoàn thành công việc.
-- Người ĐƯỢC GIAO tự chuyển việc sang "Hoàn thành", nhưng phải được người GIAO việc
-- (hoặc PM của HĐ / trưởng-phó phòng / admin) bấm xác nhận thì mới coi là chốt. Nếu không
-- đồng ý, người xác nhận trả việc về "Đang thực hiện" kèm LÝ DO — lý do được ghi vào
-- dòng thời gian trao đổi của việc.
--
-- Trong lúc chờ xác nhận, trạng thái VẪN là 'Hoàn thành' (cờ completion_pending = true chỉ
-- để hiện dấu ⏳ + nút xác nhận) → mọi báo cáo/dashboard/tiến độ hiện có giữ nguyên cách tính.

ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS completion_pending      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_requested_by integer REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_approved_by  integer REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS completion_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS completion_reject_reason text,
  ADD COLUMN IF NOT EXISTS completion_reject_count  integer NOT NULL DEFAULT 0;

ALTER TABLE public.dept_work_task
  ADD COLUMN IF NOT EXISTS completion_pending      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_requested_by integer REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_approved_by  integer REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS completion_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS completion_reject_reason text,
  ADD COLUMN IF NOT EXISTS completion_reject_count  integer NOT NULL DEFAULT 0;

-- Chỉ mục một phần: truy vấn "việc đang chờ tôi xác nhận" chỉ quét các dòng đang chờ.
CREATE INDEX IF NOT EXISTS idx_contract_task_completion_pending
  ON public.contract_task(completion_pending) WHERE completion_pending;
CREATE INDEX IF NOT EXISTS idx_dept_work_task_completion_pending
  ON public.dept_work_task(completion_pending) WHERE completion_pending;
