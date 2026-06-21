import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel } from './notify.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tự động chuyển công việc "Chờ xử lý" → "Đang thực hiện" khi đã tới lúc làm:
//   • Không phụ thuộc      → khi start_date <= hôm nay.
//   • Có phụ thuộc         → khi TẤT CẢ bước trước đã xong (công việc 'Hoàn thành';
//                            mốc tiến độ có actual_date) VÀ MAX(ngày hoàn thành bước
//                            trước + offset_days) <= hôm nay (offset 0 → kích hoạt tức thì).
//
// "Hôm nay" tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), không phụ thuộc múi giờ máy chủ.
// Chỉ chuyển TIẾN (Chờ → Đang làm), không bao giờ lùi. Thông báo Telegram:
//   • Người phụ trách → việc cần xử lý (🔔 notifyAction).
//   • Người tạo việc  → thông tin (notifyInfo), nếu khác người phụ trách.
//
// Quét toàn bộ công việc đang chờ (rẻ ở quy mô app này); gọi được từ:
//   • Bộ lập lịch hàng ngày (đến start_date).
//   • Sự kiện hoàn thành 1 công việc / cập nhật actual_date của mốc (mở khóa tức thì).
// ──────────────────────────────────────────────────────────────────────────────

// Ngày hôm nay theo giờ VN dạng 'YYYY-MM-DD'.
function vnToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Một lượt quét: chuyển các công việc đã đủ điều kiện sang "Đang thực hiện",
// trả về danh sách đã chuyển (để báo). An toàn khi gọi đồng thời (UPDATE atomic,
// chỉ tác động dòng còn 'Chờ xử lý').
// skipNotifyIds: id các việc vẫn được kích hoạt nhưng KHÔNG gửi thông báo auto-start
// (vd việc vừa tạo đã có thông báo "được giao việc mới" riêng — tránh báo trùng).
export async function activateReadyTasks(skipNotifyIds = []) {
  const skip = new Set((skipNotifyIds || []).map(String))
  const today = vnToday()
  const { rows } = await pool.query(
    `
    WITH waiting AS (
      SELECT t.id, t.contract_out_id, t.title, t.assigned_to, t.created_by, t.start_date,
             (SELECT COUNT(*) FROM contract_task_dependency d WHERE d.task_id = t.id) AS dep_count
        FROM contract_task t
       WHERE t.status = 'Chờ xử lý'
    ),
    -- Công việc có ít nhất 1 bước trước CHƯA hoàn thành (hoặc bước trước đã bị xóa).
    unmet AS (
      SELECT DISTINCT d.task_id
        FROM contract_task_dependency d
        LEFT JOIN contract_task          pt ON pt.id = d.dep_task_id
        LEFT JOIN contract_out_progress  pm ON pm.id = d.dep_progress_id
       WHERE (d.dep_type = 'task'      AND (pt.id IS NULL OR pt.status <> 'Hoàn thành'))
          OR (d.dep_type = 'milestone' AND (pm.id IS NULL OR pm.actual_date IS NULL))
    ),
    -- Ngày kích hoạt = MAX(ngày hoàn thành bước trước + offset). offset 0 = ngay khi
    -- bước trước xong (kích hoạt tức thì); offset N = N ngày sau. Lưu ý: Gantt vẽ thanh
    -- bắt đầu ở finish + offset + 1 (tránh chồng ngày kết thúc) → trạng thái có thể
    -- "Đang thực hiện" sớm hơn vị trí thanh 1 ngày, đúng theo lựa chọn nghiệp vụ.
    dep_start AS (
      SELECT d.task_id,
             MAX(
               CASE WHEN d.dep_type = 'task'
                    THEN COALESCE((pt.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, pt.due_date)
                    ELSE pm.actual_date
               END + d.offset_days
             ) AS start_date
        FROM contract_task_dependency d
        LEFT JOIN contract_task          pt ON pt.id = d.dep_task_id
        LEFT JOIN contract_out_progress  pm ON pm.id = d.dep_progress_id
       GROUP BY d.task_id
    ),
    ready AS (
      SELECT w.id
        FROM waiting w
       WHERE w.id NOT IN (SELECT task_id FROM unmet)
         AND (
           (w.dep_count = 0 AND w.start_date IS NOT NULL AND w.start_date <= $1::date)
           OR
           (w.dep_count > 0 AND EXISTS (
              SELECT 1 FROM dep_start ds WHERE ds.task_id = w.id AND ds.start_date <= $1::date
           ))
         )
      UNION
      -- Việc con neo theo việc cha: kích hoạt khi việc cha ĐÃ bắt đầu và đã qua offset ngày
      -- kể từ ngày bắt đầu của cha (offset 0 → ngay khi cha bắt đầu; cha chưa có start_date
      -- cụ thể nhưng đã chạy → kích hoạt luôn).
      SELECT t.id
        FROM contract_task t
        JOIN contract_task p ON p.id = t.parent_task_id
       WHERE t.status = 'Chờ xử lý'
         AND t.parent_start_offset IS NOT NULL
         AND p.status IN ('Đang thực hiện', 'Hoàn thành')
         AND (t.parent_start_offset <= 0 OR p.start_date IS NULL
              OR (p.start_date + t.parent_start_offset) <= $1::date)
    )
    UPDATE contract_task t
       SET status = 'Đang thực hiện', updated_at = NOW()
      FROM ready r
     WHERE t.id = r.id AND t.status = 'Chờ xử lý'
    RETURNING t.id, t.contract_out_id, t.title, t.assigned_to, t.created_by
    `,
    [today],
  )

  for (const r of rows) {
    if (skip.has(String(r.id))) continue
    const label = await contractLabel(r.contract_out_id)
    const assignee = Number(r.assigned_to) || null
    const creator  = Number(r.created_by) || null
    if (assignee) {
      notifyAction([assignee], `Công việc "${r.title}" (HĐ ${label}) đã đến lúc thực hiện — chuyển sang "Đang thực hiện".`)
    }
    if (creator && creator !== assignee) {
      notifyInfo([creator], `Công việc "${r.title}" (HĐ ${label}) đã tự chuyển sang "Đang thực hiện".`)
    }
  }
  return rows
}

// Gọi không cần await: tự nuốt lỗi để không ảnh hưởng luồng nghiệp vụ gọi tới.
export function activateReadyTasksSafe() {
  activateReadyTasks().catch(err => console.error('activateReadyTasks:', err))
}

// Bộ lập lịch: kiểm tra mỗi phút, chạy 1 lần/ngày vào AUTO_START_TIME (giờ VN, mặc
// định 00:10) — bắt các việc tới start_date. Chạy mọi ngày (kể cả T7/CN: ngày vẫn
// trôi). Quét ngay 1 lần lúc khởi động để bù khi máy chủ vừa restart.
export function startTaskAutoStartScheduler() {
  if (process.env.AUTO_START_ENABLED === 'false') return
  const time = (process.env.AUTO_START_TIME || '00:10').trim()
  let lastFired = null

  const tick = () => {
    const now = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date())
    const o = {}
    for (const p of now) o[p.type] = p.value
    const hour = o.hour === '24' ? '00' : o.hour
    const hhmm = `${hour}:${o.minute}`
    const key = `${o.year}-${o.month}-${o.day} ${hhmm}`
    if (hhmm === time && lastFired !== key) {
      lastFired = key
      activateReadyTasksSafe()
    }
  }
  setInterval(tick, 60 * 1000)
  activateReadyTasksSafe()   // quét bù khi khởi động
  console.log(`[auto-start] đã bật — quét công việc tới hạn bắt đầu lúc ${time} (giờ VN) hằng ngày`)
}
