-- Thứ tự thủ công cho công việc triển khai (kéo-thả sắp xếp ở Gantt chế độ "Không nhóm").
ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill theo đúng thứ tự đang hiển thị (phòng ban → hạn → id) để giao diện ban đầu
-- không đổi; từ đó người dùng kéo-thả mới thay đổi.
WITH ord AS (
  SELECT id, row_number() OVER (
    PARTITION BY contract_out_id
    ORDER BY department_id NULLS LAST, due_date NULLS LAST, id
  ) AS rn
  FROM public.contract_task
)
UPDATE public.contract_task t SET sort_order = ord.rn
  FROM ord WHERE ord.id = t.id;

CREATE INDEX IF NOT EXISTS idx_contract_task_sort
  ON public.contract_task (contract_out_id, sort_order);
