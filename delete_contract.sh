#!/bin/bash
# Xóa hoàn toàn hợp đồng và toàn bộ dữ liệu liên quan
# Cách dùng: bash delete_contract.sh HD-2026-007

CONTRACT_NO="${1:-HD-2026-007}"

# Đọc DATABASE_URL từ .env
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Lỗi: Không tìm thấy DATABASE_URL trong .env"
  exit 1
fi

# Tìm hợp đồng
echo ">>> Tìm hợp đồng: $CONTRACT_NO"
INFO=$(psql "$DATABASE_URL" -t -A -F ' | ' -c \
  "SELECT id, contract_no, project_name, status
   FROM contract_out
   WHERE UPPER(TRIM(contract_no)) = UPPER(TRIM('$CONTRACT_NO'))
     AND COALESCE(is_deleted, false) = false;")

if [ -z "$INFO" ]; then
  echo "Không tìm thấy hợp đồng '$CONTRACT_NO' (hoặc đã bị xóa trước đó)"
  exit 1
fi

echo "Thông tin: $INFO"
echo ""
echo "Các bảng sẽ bị xóa theo (theo thứ tự):"
echo "  - contract_out_boq"
echo "  - contract_out_progress"
echo "  - contract_receivable_payment"
echo "  - contract_receivable"
echo "  - contract_out (CASCADE → member, task, guarantee, equipment, warranty, document, contract_in)"
echo ""
read -p "Nhập 'YES' để xác nhận xóa vĩnh viễn: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "Đã hủy."
  exit 0
fi

CONTRACT_ID=$(echo "$INFO" | cut -d'|' -f1 | tr -d ' ')

echo ""
echo ">>> Bắt đầu xóa (contract id = $CONTRACT_ID)..."

psql "$DATABASE_URL" <<SQL
BEGIN;

DELETE FROM public.contract_out_boq         WHERE contract_out_id = $CONTRACT_ID;
DELETE FROM public.contract_out_progress    WHERE contract_out_id = $CONTRACT_ID;
DELETE FROM public.contract_receivable_payment WHERE contract_out_id = $CONTRACT_ID;
DELETE FROM public.contract_receivable      WHERE contract_out_id = $CONTRACT_ID;

-- Xóa contract_out → CASCADE tự xử lý:
--   contract_out_member, document_folder, document_file,
--   contract_guarantee, contract_task, contract_task_attachment,
--   contract_equipment, equipment_serial, warranty_case,
--   warranty_case_equipment, warranty_activity, contract_in
DELETE FROM public.contract_out WHERE id = $CONTRACT_ID;

COMMIT;
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "Xóa thành công hợp đồng '$CONTRACT_NO' (id=$CONTRACT_ID) và toàn bộ dữ liệu liên quan."
else
  echo ""
  echo "Lỗi: Transaction bị rollback. Không có dữ liệu nào bị xóa."
  exit 1
fi
