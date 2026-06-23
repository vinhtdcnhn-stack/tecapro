-- 072_tender_item_documents.sql
-- Tệp sản phẩm của đầu việc checklist → chuyển từ danh sách PHẲNG (tender_checklist_attachment)
-- sang hệ thư mục/tệp dùng chung document_folder/document_file, khoá theo item_id.
-- Khác Hồ sơ mời thầu (khoá tender_id): tệp sản phẩm khoá item_id, để tender_id/contract_id
-- NULL nên KHÔNG bao giờ lẫn với hồ sơ mời thầu của gói.
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Khoá theo đầu việc cho thư mục + tệp ────────────────────────────────────
ALTER TABLE document_folder ADD COLUMN IF NOT EXISTS item_id bigint
  REFERENCES tender_checklist_item(id) ON DELETE CASCADE;
ALTER TABLE document_file ADD COLUMN IF NOT EXISTS item_id bigint
  REFERENCES tender_checklist_item(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_document_folder_item ON document_folder(item_id);
CREATE INDEX IF NOT EXISTS idx_document_file_item   ON document_file(item_id);

-- ── Chuyển dữ liệu cũ: mỗi tệp phẳng → 1 document_file ở thư mục gốc của đúng đầu việc.
--    Giữ nguyên bảng tender_checklist_attachment làm bản lưu (không xoá), nhưng từ nay
--    mọi nơi đọc/ghi tệp sản phẩm qua document_file(item_id).
INSERT INTO document_file (item_id, folder_id, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_at)
SELECT a.item_id, NULL, a.file_name, a.file_path, a.file_size, a.mime_type, a.uploaded_by, a.created_at
  FROM tender_checklist_attachment a
 WHERE NOT EXISTS (
   SELECT 1 FROM document_file df
    WHERE df.item_id = a.item_id AND df.file_path = a.file_path
 );

COMMIT;
