-- "Bắt đầu theo việc cha" (động): việc con bắt đầu theo ngày bắt đầu hiệu lực của việc
-- cha + offset ngày. parent_start_offset NULL = không neo theo cha (dùng ngày cố định /
-- bước trước như cũ); NOT NULL (kể cả 0) = neo theo việc cha, lệch `parent_start_offset` ngày.
ALTER TABLE public.contract_task
  ADD COLUMN IF NOT EXISTS parent_start_offset integer;
