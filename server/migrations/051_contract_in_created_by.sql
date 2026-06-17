-- 049_contract_in_created_by.sql
-- Thêm cột người tạo cho hợp đồng nhập. HĐ nhập thuộc sở hữu của người tạo:
-- chỉ người tạo (created_by) hoặc admin mới được ghi HĐ nhập + các tab con.
-- Người có vai Xuất nhập khẩu (ImportExport) hoặc PM của HĐ bán cha được TẠO HĐ nhập.

ALTER TABLE contract_in ADD COLUMN IF NOT EXISTS created_by bigint REFERENCES app_user(id);

-- Backfill dữ liệu cũ: gán PM chính của HĐ bán cha làm người tạo, để PM hiện tại
-- giữ nguyên quyền với các HĐ nhập đã tồn tại.
UPDATE contract_in ci SET created_by = (
  SELECT m.user_id FROM contract_out_member m
   WHERE m.contract_out_id = ci.contract_out_id
     AND m.member_role = 'PM' AND m.is_primary = true
   LIMIT 1
) WHERE ci.created_by IS NULL;
