-- Gắn lại linh kiện "mồ côi" phía bán (equipment_serial.parent_serial_id = NULL) vào máy cha.
-- Nguyên nhân: xóa serial máy → FK ON DELETE SET NULL làm linh kiện thành serial rời, thêm
-- lại máy thì linh kiện đã tồn tại bị bỏ qua → cả loại linh kiện (Mainboard, PSU…) hiện thành
-- mục riêng ở tab bàn giao. Code đã sửa (xóa máy xóa kèm linh kiện + kéo lại thì gắn lại);
-- file này chỉ sửa dữ liệu cũ. Máy cha xác định qua phía NHẬP: linh kiện ic có cha ip,
-- serial máy bên bán trùng ip.serial_no và cùng HĐ bán. Chạy lại nhiều lần vô hại.
UPDATE equipment_serial c
   SET parent_serial_id = m.id
  FROM contract_in_delivery_serial ic
  JOIN contract_in_delivery_serial ip ON ip.id = ic.parent_serial_id,
       equipment_serial m
  JOIN contract_equipment me ON me.id = m.equipment_id,
       contract_equipment ce
 WHERE c.parent_serial_id IS NULL
   AND ce.id = c.equipment_id
   AND lower(trim(ic.serial_no)) = lower(trim(c.serial_no))
   AND lower(trim(m.serial_no))  = lower(trim(ip.serial_no))
   AND me.contract_out_id = ce.contract_out_id
   AND m.id <> c.id;
