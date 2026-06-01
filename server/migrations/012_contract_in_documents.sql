-- Cho phép document_folder và document_file liên kết với cả contract_out lẫn contract_in
ALTER TABLE public.document_folder
  ALTER COLUMN contract_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contract_in_id BIGINT REFERENCES contract_in(id) ON DELETE CASCADE;

ALTER TABLE public.document_file
  ALTER COLUMN contract_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS contract_in_id BIGINT REFERENCES contract_in(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_doc_folder_contract_in ON public.document_folder(contract_in_id);
CREATE INDEX IF NOT EXISTS idx_doc_file_contract_in   ON public.document_file(contract_in_id);
