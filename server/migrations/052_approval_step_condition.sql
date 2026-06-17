-- 052_approval_step_condition.sql
-- Bước duyệt có điều kiện theo CHỨC DANH người gửi, để 1 chuỗi duyệt linh hoạt theo cấp.
--   condition_mode:
--     'always'  — bước áp dụng cho mọi người gửi (mặc định)
--     'include' — chỉ áp dụng khi người gửi có ≥1 chức danh trong condition_positions
--     'exclude' — áp dụng cho mọi người TRỪ khi người gửi có chức danh trong condition_positions
--   condition_positions — mảng position_id (jsonb).
-- Lúc gửi đơn, bước không hợp điều kiện sẽ bị bỏ (kèm dedup + bỏ chính người gửi).
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE approval_form_step
  ADD COLUMN IF NOT EXISTS condition_mode      varchar(10) NOT NULL DEFAULT 'always',
  ADD COLUMN IF NOT EXISTS condition_positions jsonb       NOT NULL DEFAULT '[]';

COMMIT;
