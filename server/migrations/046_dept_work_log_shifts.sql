-- Nhật ký công việc: thay nhập giờ tay bằng chọn buổi làm.
-- Lưu các buổi đã chọn ('dem_truoc' | 'sang' | 'chieu'); effort_hours = số buổi × 4.
ALTER TABLE dept_work_log
  ADD COLUMN IF NOT EXISTS shifts text[] NOT NULL DEFAULT '{}';
