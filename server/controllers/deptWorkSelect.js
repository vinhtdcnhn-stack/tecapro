// Câu SELECT dùng chung cho việc của phòng (dept_work_task) — tách khỏi
// deptWorkTaskController để controller trạng thái/xác nhận trả cùng hình dạng dữ liệu.
export const BASE_SELECT = `
  SELECT
    t.id, t.department_id, t.team_id, tm.name AS team_name, tm.code AS team_code,
    t.title, t.description, t.instructions, t.priority, t.due_date, t.status,
    t.created_by, cb.full_name AS created_by_name, t.completed_at,
    t.completion_pending, t.completion_requested_by, rb.full_name AS completion_requested_by_name,
    t.completion_requested_at, t.completion_approved_by, ab.full_name AS completion_approved_by_name,
    t.completion_approved_at, t.completion_reject_reason, t.completion_reject_count,
    t.origin, t.customer_name, t.customer_contact,
    t.escalated, t.escalated_by, eb.full_name AS escalated_by_name,
    t.escalated_at, t.escalation_note, t.created_at, t.updated_at,
    (SELECT COUNT(*) FROM dept_work_task_attachment a WHERE a.task_id = t.id)::int AS attachment_count,
    (
      SELECT json_build_object(
        'entry_type', le.entry_type, 'content', le.content,
        'author_name', lau.full_name, 'created_at', le.created_at
      )
      FROM dept_work_entry le
      LEFT JOIN app_user lau ON lau.id = le.author_id
      WHERE le.task_id = t.id AND le.entry_type IN ('directive', 'decision')
      ORDER BY le.created_at DESC, le.id DESC
      LIMIT 1
    ) AS latest_directive,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', asg.id, 'assignee_id', asg.assignee_id, 'assignee_name', au.full_name,
        'is_lead', asg.is_lead, 'accept_state', asg.accept_state,
        'instructions', asg.instructions, 'handoff_from', asg.handoff_from
      ) ORDER BY asg.is_lead DESC, au.full_name)
      FROM dept_work_assignment asg JOIN app_user au ON au.id = asg.assignee_id
      WHERE asg.task_id = t.id AND asg.is_active
    ), '[]') AS assignees
  FROM dept_work_task t
  LEFT JOIN dept_work_team tm ON tm.id = t.team_id
  LEFT JOIN app_user cb ON cb.id = t.created_by
  LEFT JOIN app_user eb ON eb.id = t.escalated_by
  LEFT JOIN app_user rb ON rb.id = t.completion_requested_by
  LEFT JOIN app_user ab ON ab.id = t.completion_approved_by
`
