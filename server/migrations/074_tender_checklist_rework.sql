-- 074_tender_checklist_rework.sql
-- Module Đấu thầu — Checklist công việc: yêu cầu LÀM LẠI.
-- Khi người quản lý gói thầu chuyển đầu việc từ 'Hoàn thành' → 'Đang thực hiện'
-- để yêu cầu người nhận việc sửa lại, phải kèm LÝ DO và đếm SỐ LẦN sửa.
-- Lý do + số lần được hiển thị trong form làm việc của người nhận (MyTenderTaskPage).
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE tender_checklist_item
  ADD COLUMN IF NOT EXISTS rework_count  integer NOT NULL DEFAULT 0,  -- số lần bị yêu cầu làm lại
  ADD COLUMN IF NOT EXISTS rework_reason text;                       -- lý do yêu cầu làm lại gần nhất

COMMIT;
