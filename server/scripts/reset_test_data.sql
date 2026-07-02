-- =============================================================================
-- RESET DỮ LIỆU TEST — chuẩn bị đưa hệ thống vào vận hành thật
-- =============================================================================
-- Chạy khi BẮT ĐẦU dùng thật. Xóa toàn bộ dữ liệu giao dịch test (hợp đồng bán/
-- nhập, công việc, tài liệu, bảo hành, đấu thầu, việc phòng, đề xuất, góp ý,
-- nhật ký...) và reset lại bộ đếm ID về 1.
--
-- GIỮ LẠI (dữ liệu nền + cấu hình đã chuẩn):
--   • position            (vị trí / chức danh)
--   • department          (phòng ban)
--   • customer            (khách hàng)
--   • supplier            (nhà cung cấp)
--   • contract_bb_type    (loại biên bản)
--   • permission, position_permission, contract_role_permission (phân quyền RBAC)
--   • user_permission_override  (chỉ của các admin được giữ)
--   • approval_form* + tender_checklist_template_item (các MẪU dùng chung)
--   • app_user role=1     (giữ tài khoản ADMIN để còn đăng nhập tạo lại user)
--
-- CÁCH CHẠY:
--   psql -U postgres -h localhost -d hello_web_db -f server/scripts/reset_test_data.sql
--
-- An toàn: chạy trong 1 transaction. Nếu số liệu in ra ở cuối không như ý,
-- gõ ROLLBACK; (thay vì COMMIT) — nhưng file này đã COMMIT sẵn ở cuối.
-- Muốn thử trước: xóa dòng COMMIT ở cuối, đổi thành ROLLBACK, chạy để xem đếm.
--
-- LƯU Ý NGOÀI DB: file đính kèm vật lý trong server/uploads/ KHÔNG bị xóa bởi
-- script này. Sau khi chạy, nếu muốn dọn sạch ổ đĩa thì xóa nội dung
-- server/uploads/ (trên VPS) một cách thủ công.
-- =============================================================================

BEGIN;

-- --- Chốt an toàn: phải còn ít nhất 1 admin, nếu không sẽ bị khóa đăng nhập ---
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE role = 1) THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản admin (role=1) — dừng lại để tránh khóa đăng nhập.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) XÓA DỮ LIỆU GIAO DỊCH TEST
--    TRUNCATE ... CASCADE tự dọn các bảng con phụ thuộc; RESTART IDENTITY đưa
--    bộ đếm ID về 1. Các bảng GIỮ LẠI không tham chiếu tới bảng nào ở đây nên
--    CASCADE không đụng vào chúng.
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
  -- Hợp đồng bán + phụ thuộc
  contract_out,
  contract_out_boq,
  contract_out_delivery,
  contract_out_invoice,
  contract_out_invoice_item,
  contract_out_member,
  contract_out_progress,
  contract_out_supply_slot,
  contract_receivable,
  contract_receivable_payment,
  contract_equipment,
  contract_guarantee,
  equipment_serial,
  -- Hợp đồng nhập + phụ thuộc
  contract_in,
  contract_in_boq,
  contract_in_boq_supply_link,
  contract_in_customs,
  contract_in_delivery,
  contract_in_delivery_item,
  contract_in_delivery_serial,
  contract_in_guarantee,
  contract_in_logistics,
  contract_in_logistics_update,
  contract_in_payable,
  contract_in_payment,
  contract_in_progress,
  contract_in_supplier_warranty,
  contract_in_warranty_claim,
  -- Công việc hợp đồng
  contract_task,
  contract_task_assignment_log,
  contract_task_attachment,
  contract_task_dependency,
  contract_task_entry,
  contract_task_read,
  -- Tài liệu hợp đồng
  document,
  document_file,
  document_folder,
  -- Dashboard PM
  pm_dashboard_tracking,
  -- Bảo hành
  warranty_activity,
  warranty_case,
  warranty_case_equipment,
  -- Đấu thầu (giữ lại tender_checklist_template_item = mẫu)
  tender,
  tender_activity_log,
  tender_bidder,
  tender_checklist_attachment,
  tender_checklist_item,
  tender_document_version,
  tender_item_review,
  tender_lot,
  tender_member,
  tender_review,
  tender_summary_file,
  -- Việc phòng ban
  dept_work_assignment,
  dept_work_entry,
  dept_work_issue,
  dept_work_log,
  dept_work_task,
  dept_work_task_attachment,
  dept_work_task_read,
  dept_work_team,
  -- Đề xuất / phê duyệt (giữ lại approval_form* = mẫu quy trình)
  approval_request,
  approval_request_attachment,
  approval_request_event,
  approval_request_follower,
  approval_request_step,
  approval_request_step_approver,
  -- Góp ý
  app_feedback,
  app_feedback_image,
  -- Nhật ký / log
  change_log,
  telegram_send_log,
  overdue_alert_log
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- 2) XỬ LÝ THAM CHIẾU TỚI USER SẮP BỊ XÓA trong các bảng ĐƯỢC GIỮ
--    (user "test" = role khác 1). Gán về admin đầu tiên / NULL / xóa dòng để
--    không vi phạm khóa ngoại khi xóa user ở bước 3.
-- -----------------------------------------------------------------------------
-- Mẫu bước duyệt: người tạo -> admin đầu tiên
UPDATE approval_form
   SET created_by = (SELECT id FROM app_user WHERE role = 1 ORDER BY id LIMIT 1)
 WHERE created_by IS DISTINCT FROM NULL
   AND created_by IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

-- Người theo dõi mẫu (user_id NOT NULL) -> xóa dòng của user bị xóa
DELETE FROM approval_form_follower
 WHERE user_id IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

-- Mẫu checklist đấu thầu: người tạo -> admin đầu tiên
UPDATE tender_checklist_template_item
   SET created_by = (SELECT id FROM app_user WHERE role = 1 ORDER BY id LIMIT 1)
 WHERE created_by IS DISTINCT FROM NULL
   AND created_by IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

-- Quyền override riêng của user bị xóa -> bỏ (quyền của admin được giữ nguyên)
DELETE FROM user_permission_override
 WHERE user_id IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

-- Quản lý trực tiếp trỏ tới user bị xóa -> NULL
UPDATE app_user
   SET manager_id = NULL
 WHERE manager_id IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

-- -----------------------------------------------------------------------------
-- 3) XÓA USER TEST (giữ lại tài khoản admin role=1)
-- -----------------------------------------------------------------------------
DELETE FROM app_user_position
 WHERE user_id IN (SELECT id FROM app_user WHERE role IS DISTINCT FROM 1);

DELETE FROM app_user
 WHERE role IS DISTINCT FROM 1;

-- -----------------------------------------------------------------------------
-- 4) KIỂM TRA NHANH (đọc để đối chiếu trước khi COMMIT)
-- -----------------------------------------------------------------------------
SELECT 'app_user (còn lại - admin)' AS bang, count(*) FROM app_user
UNION ALL SELECT 'contract_out', count(*) FROM contract_out
UNION ALL SELECT 'contract_in',  count(*) FROM contract_in
UNION ALL SELECT 'tender',       count(*) FROM tender
UNION ALL SELECT 'customer (giữ)',   count(*) FROM customer
UNION ALL SELECT 'supplier (giữ)',   count(*) FROM supplier
UNION ALL SELECT 'position (giữ)',   count(*) FROM position
UNION ALL SELECT 'department (giữ)', count(*) FROM department
UNION ALL SELECT 'contract_bb_type (giữ)', count(*) FROM contract_bb_type
ORDER BY 1;

COMMIT;
-- Muốn hủy thay vì áp dụng: đổi dòng trên thành  ROLLBACK;
