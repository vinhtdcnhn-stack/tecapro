// Câu SELECT dùng chung cho công việc hợp đồng (contract_task) — tách khỏi taskController
// để cả taskController và taskStatusController trả về cùng một hình dạng dữ liệu.
export const BASE_SELECT = `
  SELECT
    t.id,
    t.contract_out_id,
    t.title,
    t.description,
    t.department_id,
    d.name  AS department_name,
    t.assigned_to,
    u.full_name AS assigned_to_name,
    t.created_by,
    cb.full_name AS created_by_name,
    t.priority,
    t.start_date,
    t.due_date,
    t.duration_days,
    t.status,
    t.note,
    t.completed_at,
    t.sort_order,
    t.parent_task_id,
    t.parent_start_offset,
    -- Xác nhận hoàn thành: cờ chờ duyệt + người báo/người duyệt + lý do trả lại gần nhất.
    t.completion_pending,
    t.completion_requested_by,
    rb.full_name AS completion_requested_by_name,
    t.completion_requested_at,
    t.completion_approved_by,
    ab.full_name AS completion_approved_by_name,
    t.completion_approved_at,
    t.completion_reject_reason,
    t.completion_reject_count,
    (SELECT COUNT(*) FROM contract_task c WHERE c.parent_task_id = t.id)::int AS child_count,
    t.created_at,
    t.updated_at,
    (SELECT COUNT(*) FROM contract_task_attachment WHERE task_id = t.id)::int AS attachment_count,
    (SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path) ORDER BY a.created_at)
     FROM contract_task_attachment a WHERE a.task_id = t.id) AS attachments,
    COALESCE((SELECT json_agg(json_build_object(
        'id', dep.id, 'dep_type', dep.dep_type,
        'dep_task_id', dep.dep_task_id, 'dep_progress_id', dep.dep_progress_id,
        'offset_days', dep.offset_days) ORDER BY dep.id)
     FROM contract_task_dependency dep WHERE dep.task_id = t.id), '[]') AS dependencies
  FROM contract_task t
  LEFT JOIN department d  ON d.id  = t.department_id
  LEFT JOIN app_user   u  ON u.id  = t.assigned_to
  LEFT JOIN app_user   cb ON cb.id = t.created_by
  LEFT JOIN app_user   rb ON rb.id = t.completion_requested_by
  LEFT JOIN app_user   ab ON ab.id = t.completion_approved_by
`
