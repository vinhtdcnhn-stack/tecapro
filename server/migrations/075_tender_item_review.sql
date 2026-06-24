-- 075_tender_item_review.sql
-- Module Đấu thầu — Review theo TỪNG ĐẦU VIỆC (thay cho review cả gói theo phiên bản).
-- Sau khi người thực hiện đặt đầu việc 'Hoàn thành', NGƯỜI PHỤ TRÁCH GÓI (bid_maker)
-- rà soát tệp sản phẩm: đánh dấu loại bớt file/thư mục không gửi review, tải lên file
-- THAY THẾ (giữ nguyên bản gốc để đối chiếu), rồi GỬI cả đầu việc sang Trưởng ban duyệt.
--   • review_status: 'draft' → 'pending' → 'approved' | 'returned'
--     ('returned' = trả về NGƯỜI PHỤ TRÁCH GÓI curate lại rồi gửi lại)
--   • Đánh dấu loại = review_excluded (KHÔNG xoá file, chỉ loại khỏi tập gửi review)
--   • Đánh dấu thay thế = replaces_file_id (file mới thế chỗ file gốc trong tập review)
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- Vòng đời review của đầu việc.
ALTER TABLE tender_checklist_item
  ADD COLUMN IF NOT EXISTS review_status       text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS review_submitted_by bigint,
  ADD COLUMN IF NOT EXISTS review_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_decided_by   bigint,
  ADD COLUMN IF NOT EXISTS review_decided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS review_comment      text;

-- Đánh dấu curate trên tệp/thư mục sản phẩm (document_file.id / document_folder.id là integer).
ALTER TABLE document_file
  ADD COLUMN IF NOT EXISTS review_excluded  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replaces_file_id integer REFERENCES document_file(id) ON DELETE SET NULL;

ALTER TABLE document_folder
  ADD COLUMN IF NOT EXISTS review_excluded  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_df_replaces ON document_file(replaces_file_id);

-- Lịch sử các vòng duyệt của Trưởng ban trên từng đầu việc (mirror tender_review).
CREATE TABLE IF NOT EXISTS tender_item_review (
  id          bigserial PRIMARY KEY,
  item_id     bigint      NOT NULL REFERENCES tender_checklist_item(id) ON DELETE CASCADE,
  reviewer_id integer     REFERENCES app_user(id),
  conclusion  varchar(10) NOT NULL,                   -- 'pass' | 'fail'
  comment     text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tir_item ON tender_item_review(item_id);

COMMIT;
