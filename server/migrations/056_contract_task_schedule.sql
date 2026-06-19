-- Lịch Gantt cho công việc triển khai (HĐ bán):
--  • start_date: ngày bắt đầu cố định (dùng khi công việc KHÔNG có phụ thuộc).
--  • contract_task_dependency: ràng buộc "bắt đầu sau khi bước trước hoàn thành".
--    Một công việc có thể phụ thuộc NHIỀU bước (công việc khác hoặc mốc tiến độ HĐ);
--    ngày bắt đầu hiệu lực = MAX(ngày hoàn thành từng bước + offset_days).
ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS start_date date;

-- duration_days: nếu != NULL, công việc làm trong N ngày (gồm cả ngày bắt đầu) →
-- thời hạn hoàn thành = ngày bắt đầu hiệu lực + (duration_days - 1).
-- Khi NULL → due_date là ngày cố định người dùng nhập.
ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS duration_days integer;

CREATE TABLE IF NOT EXISTS public.contract_task_dependency (
  id              bigserial PRIMARY KEY,
  task_id         integer NOT NULL REFERENCES public.contract_task(id) ON DELETE CASCADE,        -- việc phụ thuộc
  dep_type        varchar(12) NOT NULL,                                                          -- 'task' | 'milestone'
  dep_task_id     integer REFERENCES public.contract_task(id) ON DELETE CASCADE,                 -- khi dep_type='task'
  dep_progress_id bigint  REFERENCES public.contract_out_progress(id) ON DELETE CASCADE,         -- khi dep_type='milestone'
  offset_days     integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT contract_task_dependency_target_chk CHECK (
       (dep_type = 'task'      AND dep_task_id     IS NOT NULL AND dep_progress_id IS NULL)
    OR (dep_type = 'milestone' AND dep_progress_id IS NOT NULL AND dep_task_id     IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ctask_dep_task ON public.contract_task_dependency(task_id);
