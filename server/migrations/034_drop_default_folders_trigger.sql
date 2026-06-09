-- Ngừng tự động tạo cây thư mục mặc định khi tạo hợp đồng mới.
-- Gỡ trigger; giữ lại các function (create_default_contract_folders,
-- trigger_create_default_folders) phòng khi sau này muốn bật lại.

DROP TRIGGER IF EXISTS trg_create_default_folders ON public.contract_out;
