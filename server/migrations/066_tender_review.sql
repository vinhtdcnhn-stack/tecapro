-- 066_tender_review.sql
-- Module Đấu thầu — GĐ3: Review & Versioning. Người làm thầu trình hồ sơ qua các phiên
-- bản (v1, v2…); Trưởng phòng review, comment, kết luận Đạt/Chưa đạt; chưa đạt thì trả về
-- sửa → up bản mới → trình lại. Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Phiên bản hồ sơ trình review ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_document_version (
  id          bigserial PRIMARY KEY,
  tender_id   bigint       NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  version_no  integer      NOT NULL,                  -- 1, 2, 3… theo từng gói
  file_name   varchar(255) NOT NULL,
  file_path   varchar(500) NOT NULL,                  -- '/uploads/tender-versions/{tenderId}/{ts}_{safe}'
  file_size   bigint,
  mime_type   varchar(150),
  note        text,                                   -- ghi chú khi trình (vd: đã sửa theo góp ý)
  uploaded_by integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now(),
  UNIQUE (tender_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_tdv_tender ON tender_document_version(tender_id);

-- ── Vòng review của Trưởng phòng trên một phiên bản ──────────────────────────
CREATE TABLE IF NOT EXISTS tender_review (
  id          bigserial PRIMARY KEY,
  tender_id   bigint      NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  version_id  bigint      NOT NULL REFERENCES tender_document_version(id) ON DELETE CASCADE,
  reviewer_id integer     REFERENCES app_user(id),
  conclusion  varchar(10) NOT NULL,                   -- 'pass' | 'fail'
  comment     text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trv_tender  ON tender_review(tender_id);
CREATE INDEX IF NOT EXISTS idx_trv_version ON tender_review(version_id);

COMMIT;
