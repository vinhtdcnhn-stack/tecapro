-- 070_tender_documents.sql
-- Module Đấu thầu — Hồ sơ mời thầu dùng lại hệ thống thư mục/tệp của tài liệu HĐ
-- (document_folder / document_file), thêm khoá ngoại tender_id. Cho phép tải tệp
-- vào THƯ MỤC GỐC nên document_file.folder_id phải NULL được.
-- Thay thế cách lưu phẳng tender_invitation_file (069) — bảng đó không còn dùng.
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE public.document_folder
  ADD COLUMN IF NOT EXISTS tender_id bigint REFERENCES public.tender(id) ON DELETE CASCADE;

ALTER TABLE public.document_file
  ADD COLUMN IF NOT EXISTS tender_id bigint REFERENCES public.tender(id) ON DELETE CASCADE;

-- Tệp ở thư mục gốc không có folder_id → cho phép NULL.
ALTER TABLE public.document_file
  ALTER COLUMN folder_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_folder_tender ON public.document_folder(tender_id);
CREATE INDEX IF NOT EXISTS idx_document_file_tender   ON public.document_file(tender_id);

-- Bỏ cách lưu phẳng cũ (migration 069 đã bị huỷ, không áp lên VPS).
DROP TABLE IF EXISTS public.tender_invitation_file;

COMMIT;
