-- Công việc con (sub-task): cây công việc nhiều cấp trong tab Công việc HĐ bán.
-- parent_task_id NULL = việc gốc; trỏ tới việc cha → là việc con. Xoá cha xoá cả cây
-- con (ON DELETE CASCADE). parent_task_id đặt khi tạo, không re-parent (tránh vòng lặp).
ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS parent_task_id integer
  REFERENCES public.contract_task(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contract_task_parent ON public.contract_task(parent_task_id);
