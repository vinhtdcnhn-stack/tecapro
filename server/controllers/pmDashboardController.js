import { pool } from '../db.js'
import { computeForecasts } from '../utils/progressForecast.js'
import { cacheWrap } from '../cache.js'
import { pmDashKey, assignedTasksKey, invalidateUserDashboards } from '../services/cacheKeys.js'

const DASH_TTL = 5 * 60 // 5' — tổng hợp nặng; chấp nhận unread trễ tối đa 5' (badge real-time riêng)

const iso = (v) => (v ? String(v).slice(0, 10) : null)
const todayISO = () => new Date(new Date().toDateString()).toISOString().slice(0, 10)
const emptySummary = () => ({ contractCount: 0, totalVnd: 0, totalUsd: 0, upcomingCount: 0 })

function fmtMoney(n, cur = 'VND') {
  const num = parseFloat(n) || 0
  if (cur === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(num))
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num)
}

// Gắn unread_count cho công việc HĐ ('task'), việc phòng ('dept_work_task') và đầu việc
// đấu thầu ('tender_checklist') — để dashboard tô nền hổ phách dòng việc khi có nội dung
// dòng thời gian chưa đọc (song song chấm chưa đọc trong tab). Sửa items tại chỗ.
export async function attachUnread(items, userId) {
  const taskIds = items.filter(i => i.source_type === 'task').map(i => i.source_id)
  const dwIds   = items.filter(i => i.source_type === 'dept_work_task').map(i => i.source_id)
  const tnIds   = items.filter(i => i.source_type === 'tender_checklist').map(i => i.source_id)
  // entryTbl/readTbl gắn với cột khóa `col` (task_id với HĐ/phòng, item_id với đấu thầu).
  const countUnread = (entryTbl, readTbl, col, ids) =>
    ids.length
      ? pool.query(
          `SELECT e.${col} AS k, COUNT(*)::int AS c
             FROM ${entryTbl} e
             LEFT JOIN ${readTbl} r ON r.${col} = e.${col} AND r.user_id = $1
            WHERE e.author_id <> $1 AND e.${col} = ANY($2)
              AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
            GROUP BY e.${col}`, [userId, ids])
          .then(r => new Map(r.rows.map(x => [String(x.k), x.c])))
      : Promise.resolve(new Map())
  const [ctMap, dwMap, tnMap] = await Promise.all([
    countUnread('contract_task_entry', 'contract_task_read', 'task_id', taskIds),
    countUnread('dept_work_entry', 'dept_work_task_read', 'task_id', dwIds),
    countUnread('tender_checklist_entry', 'tender_checklist_read', 'item_id', tnIds),
  ])
  items.forEach(i => {
    if (i.source_type === 'task') i.unread_count = ctMap.get(String(i.source_id)) || 0
    else if (i.source_type === 'dept_work_task') i.unread_count = dwMap.get(String(i.source_id)) || 0
    else if (i.source_type === 'tender_checklist') i.unread_count = tnMap.get(String(i.source_id)) || 0
  })
}

// GET /api/pm/:userId/dashboard
export async function getPMDashboard(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId không hợp lệ' })
  try {
    const payload = await cacheWrap(pmDashKey(userId), DASH_TTL, async () => {
    // 1+2. Các HĐ (chưa xóa) mà user được phân công BẤT KỲ vai trò nào (PM, kinh
    // doanh, presale, kỹ thuật, kế toán, người theo dõi) — DISTINCT khử trùng nếu
    // user giữ nhiều vai trò trong cùng một HĐ.
    const { rows: contracts } = await pool.query(
      `SELECT DISTINCT co.id, co.contract_no, co.project_name, co.contract_date,
              co.amount_after_vat, co.currency_code, co.exchange_rate
         FROM contract_out co
         JOIN contract_out_member m ON m.contract_out_id = co.id AND m.user_id = $1
        WHERE COALESCE(co.is_deleted, false) = false`, [userId])
    const ids = contracts.map(c => c.id)
    if (!ids.length) return { summary: emptySummary(), items: [] }
    // Key theo String vì contract_out.id (bigint→chuỗi) vs *.contract_out_id (integer→số) khác kiểu
    const cmap = new Map(contracts.map(c => [String(c.id), c]))
    const getC = (cid) => cmap.get(String(cid))

    // Các nguồn phía bán + danh sách HĐ nhập đều chỉ phụ thuộc `ids` (và trk theo userId)
    // → nạp song song để giảm số round-trip xuống DB (trước đây chạy tuần tự).
    const [
      { rows: trk },
      { rows: prog },
      { rows: recv },
      { rows: guar },
      { rows: tasks },
      { rows: inContracts },
    ] = await Promise.all([
      pool.query(
        'SELECT source_type, source_id, pinned, remind_at FROM pm_dashboard_tracking WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT p.*, t.code AS bb_code, t.name AS bb_name
           FROM contract_out_progress p
           LEFT JOIN contract_bb_type t ON t.id = p.bb_type_id
          WHERE p.contract_out_id = ANY($1)
          ORDER BY p.contract_out_id, p.sort_order, p.id`, [ids]),
      pool.query(
        `SELECT r.id, r.contract_out_id, r.description, r.due_date, r.amount, r.currency_code,
                COALESCE((SELECT SUM(amount) FROM contract_receivable_payment pm
                           WHERE pm.schedule_id = r.id), 0) AS paid
           FROM contract_receivable r
          WHERE r.contract_out_id = ANY($1) AND r.due_date IS NOT NULL`, [ids]),
      pool.query(
        `SELECT id, contract_out_id, guarantee_type, expiry_date
           FROM contract_guarantee
          WHERE contract_out_id = ANY($1) AND expiry_date IS NOT NULL
            AND COALESCE(status, '') <> 'Đã hoàn trả'`, [ids]),
      pool.query(
        `SELECT t.id, t.contract_out_id, t.title, t.due_date,
                t.assigned_to, t.created_by, t.parent_task_id,
                u.full_name AS assigned_to_name
           FROM contract_task t
           LEFT JOIN app_user u ON u.id = t.assigned_to
          WHERE t.contract_out_id = ANY($1) AND t.due_date IS NOT NULL
            AND t.status NOT IN ('Hoàn thành', 'Completed', 'Đã hủy', 'Cancelled')`, [ids]),
      pool.query(
        'SELECT id, contract_no, contract_out_id, contract_date FROM contract_in WHERE contract_out_id = ANY($1)', [ids]),
    ])

    const tmap = new Map(trk.map(t => [`${t.source_type}:${t.source_id}`, t]))
    const attach = (it) => {
      const t = tmap.get(`${it.source_type}:${it.source_id}`)
      return { side: 'Bán', ...it, pinned: t?.pinned || false, remind_at: t?.remind_at ? iso(t.remind_at) : null }
    }

    const items = []

    // ── Biên bản: thời hạn = Ngày dự kiến (forecast), chỉ mốc chưa ký ──
    const byContract = new Map()
    prog.forEach(p => {
      if (!byContract.has(p.contract_out_id)) byContract.set(p.contract_out_id, [])
      byContract.get(p.contract_out_id).push(p)
    })
    for (const [cid, rows] of byContract) {
      const c = getC(cid)
      const fc = computeForecasts(rows, c?.contract_date)
      rows.forEach(p => {
        if (p.actual_date) return                  // đã ký → không cần theo dõi
        const due = fc[p.id] || iso(p.planned_date) // ưu tiên dự kiến, dự phòng theo HĐ
        if (!due) return
        items.push(attach({
          source_type: 'progress', source_id: p.id, contract_id: cid,
          contract_no: c?.contract_no, due_date: due,
          title: [p.bb_code, p.bb_name].filter(Boolean).join(' – ') || 'Biên bản',
          sub: 'Mốc dự kiến', kind: 'Biên bản',
        }))
      })
    }

    // ── Công nợ: thời hạn = due_date, chỉ khoản còn thiếu ──
    recv.forEach(r => {
      const shortage = (parseFloat(r.amount) || 0) - (parseFloat(r.paid) || 0)
      if (shortage <= 0) return
      const c = getC(r.contract_out_id)
      items.push(attach({
        source_type: 'receivable', source_id: r.id, contract_id: r.contract_out_id,
        contract_no: c?.contract_no, due_date: iso(r.due_date),
        title: r.description || 'Khoản phải thu',
        sub: `Còn thiếu ${fmtMoney(shortage, r.currency_code)} ${r.currency_code || 'VND'}`, kind: 'Công nợ',
      }))
    })

    // ── Bảo lãnh: thời hạn = expiry_date ──
    guar.forEach(g => {
      const c = getC(g.contract_out_id)
      items.push(attach({
        source_type: 'guarantee', source_id: g.id, contract_id: g.contract_out_id,
        contract_no: c?.contract_no, due_date: iso(g.expiry_date),
        title: g.guarantee_type || 'Bảo lãnh', sub: 'Hết hiệu lực', kind: 'Bảo lãnh',
      }))
    })

    // ── Công việc triển khai: thời hạn = due_date, chỉ việc chưa xong ──
    // Chuyển việc tạo "việc con" sao chép y hệt việc cha (cùng HĐ + tiêu đề + hạn) → mỗi
    // lần chuyển sinh thêm một dòng trùng. Gộp các dòng trùng rồi chọn dòng để hiện:
    //   • Có "việc tôi giao đi" (tôi tạo khi chuyển cho người khác) → hiện HẾT các việc đó,
    //     mỗi người tôi giao là một dòng theo dõi (kèm tên người nhận để phân biệt).
    //   • Không có → hiện "việc giao đến tôi" (assigned_to = tôi).
    //   • Vẫn không → gộp về một dòng đại diện (việc gốc) để tránh trùng.
    // Dòng đã ghim luôn được giữ thêm để không che mất lựa chọn của user.
    const isPinned = (t) => tmap.get(`task:${t.id}`)?.pinned || false
    const givenAway = (t) => Number(t.created_by) === userId && t.parent_task_id != null

    const taskGroups = new Map()
    tasks.forEach(t => {
      const key = `${t.contract_out_id}|${t.title || ''}|${iso(t.due_date)}`
      if (!taskGroups.has(key)) taskGroups.set(key, [])
      taskGroups.get(key).push(t)
    })

    for (const group of taskGroups.values()) {
      const mine = group.filter(givenAway)
      let chosen
      if (mine.length) {
        chosen = mine
      } else {
        const assignedToMe = group.filter(t => Number(t.assigned_to) === userId)
        chosen = assignedToMe.length
          ? assignedToMe
          : [group.find(t => t.parent_task_id == null) || group[0]]
      }
      // Bổ sung các dòng đã ghim chưa nằm trong tập đã chọn.
      const ids = new Set(chosen.map(t => t.id))
      group.forEach(t => { if (isPinned(t) && !ids.has(t.id)) { chosen.push(t); ids.add(t.id) } })

      chosen.forEach(t => {
        const c = getC(t.contract_out_id)
        items.push(attach({
          source_type: 'task', source_id: t.id, contract_id: t.contract_out_id,
          contract_no: c?.contract_no, due_date: iso(t.due_date),
          title: t.title || 'Công việc', kind: 'Công việc',
          sub: givenAway(t) ? `Đã giao: ${t.assigned_to_name || '—'}` : 'Hạn hoàn thành',
        }))
      })
    }

    // ════════ NGUỒN PHÍA NHẬP — HĐ nhập thuộc các HĐ bán user tham gia ════════
    const inIds = inContracts.map(c => c.id)
    if (inIds.length) {
      const inMap = new Map(inContracts.map(c => [String(c.id), c]))
      const pushIn = ({ source_type, source_id, contract_in_id, due_date, title, sub, kind }) => {
        if (!due_date) return
        const ci = inMap.get(String(contract_in_id))
        const parent = getC(ci?.contract_out_id)
        items.push(attach({
          source_type, source_id, side: 'Nhập',
          contract_id: ci?.contract_out_id, contract_no: parent?.contract_no,
          contract_in_id: ci?.id,
          due_date: iso(due_date), title, kind,
          sub: `HĐ nhập ${ci?.contract_no || ''}${sub ? ' · ' + sub : ''}`.trim(),
        }))
      }

      // Các nguồn phía nhập đều chỉ phụ thuộc inIds → nạp song song.
      const [
        { rows: inProg },
        { rows: payRows },
        { rows: paySum },
        { rows: paidSum },
        { rows: deliv },
        { rows: customs },
        { rows: inGuar },
        { rows: supW },
      ] = await Promise.all([
        pool.query(
          `SELECT p.id, p.contract_in_id, p.planned_date, t.code AS bb_code, t.name AS bb_name
             FROM contract_in_progress p
             LEFT JOIN contract_bb_type t ON t.id = p.bb_type_id
            WHERE p.contract_in_id = ANY($1) AND p.actual_date IS NULL AND p.planned_date IS NOT NULL`, [inIds]),
        pool.query(
          'SELECT id, contract_in_id, description, due_date, amount, currency_code FROM contract_in_payable WHERE contract_in_id = ANY($1) AND due_date IS NOT NULL', [inIds]),
        pool.query(
          'SELECT contract_in_id, SUM(amount) AS total FROM contract_in_payable WHERE contract_in_id = ANY($1) GROUP BY contract_in_id', [inIds]),
        pool.query(
          'SELECT contract_in_id, SUM(amount) AS paid FROM contract_in_payment WHERE contract_in_id = ANY($1) GROUP BY contract_in_id', [inIds]),
        pool.query(
          `SELECT id, contract_in_id, batch_name, receive_date FROM contract_in_delivery
            WHERE contract_in_id = ANY($1) AND receive_date IS NOT NULL
              AND COALESCE(status,'') <> 'Đã nhận đủ'`, [inIds]),
        pool.query(
          `SELECT id, contract_in_id, declaration_no, bl_awb_no, etd, eta, customs_status
             FROM contract_in_customs
            WHERE contract_in_id = ANY($1) AND (eta IS NOT NULL OR etd IS NOT NULL)
              AND COALESCE(customs_status,'') <> 'Đã thông quan'`, [inIds]),
        pool.query(
          `SELECT id, contract_in_id, guarantee_type, expiry_date FROM contract_in_guarantee
            WHERE contract_in_id = ANY($1) AND expiry_date IS NOT NULL
              AND COALESCE(status,'') <> 'Đã hoàn trả'`, [inIds]),
        pool.query(
          `SELECT id, contract_in_id, item_name, warranty_end FROM contract_in_supplier_warranty
            WHERE contract_in_id = ANY($1) AND warranty_end IS NOT NULL`, [inIds]),
      ])

      // Biên bản nhập — planned_date, chỉ mốc chưa ký
      inProg.forEach(p => pushIn({
        source_type: 'in_progress', source_id: p.id, contract_in_id: p.contract_in_id,
        due_date: p.planned_date, kind: 'Biên bản',
        title: [p.bb_code, p.bb_name].filter(Boolean).join(' – ') || 'Biên bản nhập',
      }))

      // Công nợ phải trả NCC — due_date; bỏ HĐ đã trả đủ (tính theo tổng HĐ nhập)
      const totalPay = new Map(paySum.map(r => [String(r.contract_in_id), parseFloat(r.total) || 0]))
      const paidPay  = new Map(paidSum.map(r => [String(r.contract_in_id), parseFloat(r.paid) || 0]))
      payRows.forEach(r => {
        const k = String(r.contract_in_id)
        if ((totalPay.get(k) || 0) > 0 && (paidPay.get(k) || 0) >= (totalPay.get(k) || 0)) return // đã trả đủ
        pushIn({
          source_type: 'in_payable', source_id: r.id, contract_in_id: r.contract_in_id,
          due_date: r.due_date, kind: 'Phải trả',
          title: r.description || 'Đợt phải trả NCC',
          sub: `Phải trả ${fmtMoney(r.amount, r.currency_code)} ${r.currency_code || 'VND'}`,
        })
      })

      // Nhận hàng — receive_date, chưa nhận đủ
      deliv.forEach(d => pushIn({
        source_type: 'in_delivery', source_id: d.id, contract_in_id: d.contract_in_id,
        due_date: d.receive_date, kind: 'Nhận hàng',
        title: d.batch_name || 'Đợt nhận hàng', sub: 'Ngày nhận dự kiến',
      }))

      // Logistics / hải quan — ETA (hoặc ETD), chưa thông quan
      customs.forEach(cs => pushIn({
        source_type: 'in_customs', source_id: cs.id, contract_in_id: cs.contract_in_id,
        due_date: cs.eta || cs.etd, kind: 'Logistics',
        title: `Lô ${cs.bl_awb_no || cs.declaration_no || ''}`.trim() || 'Lô hàng nhập',
        sub: cs.eta ? 'ETA (dự kiến đến)' : 'ETD (dự kiến đi)',
      }))

      // Bảo lãnh nhập — expiry_date
      inGuar.forEach(g => pushIn({
        source_type: 'in_guarantee', source_id: g.id, contract_in_id: g.contract_in_id,
        due_date: g.expiry_date, kind: 'Bảo lãnh',
        title: g.guarantee_type || 'Bảo lãnh nhập', sub: 'Hết hiệu lực',
      }))

      // Bảo hành NCC — warranty_end
      supW.forEach(w => pushIn({
        source_type: 'in_warranty', source_id: w.id, contract_in_id: w.contract_in_id,
        due_date: w.warranty_end, kind: 'Bảo hành NCC',
        title: w.item_name || 'Bảo hành NCC', sub: 'Hết bảo hành NCC',
      }))
    }

    // ── Đầu việc checklist đấu thầu giao trực tiếp cho user ──
    // Người tham gia HĐ (PM…) vào dashboard này theo mặc định nên việc đấu thầu được
    // giao cũng phải hiện ở đây, không chỉ ở "Việc của tôi". Mở chi tiết qua trang
    // riêng /viec-dau-thau/:itemId (xem trackingUtils.targetUrl).
    const tcd = await pool.query(
      `SELECT i.id, i.title, i.due_date, t.package_name
         FROM tender_checklist_item i
         JOIN tender t ON t.id = i.tender_id
        WHERE i.assignee_id = $1
          AND i.status NOT IN ('Hoàn thành', 'Hủy')
          AND COALESCE(t.is_deleted, false) = false`, [userId])
    tcd.rows.forEach(t => {
      items.push(attach({
        source_type: 'tender_checklist', source_id: t.id, side: 'Đấu thầu',
        contract_id: null, contract_no: t.package_name, due_date: iso(t.due_date),
        title: t.title || 'Đầu việc', sub: 'Đấu thầu', kind: 'Công việc',
      }))
    })

    // ── Summary ──
    const soon = new Date(todayISO()); soon.setDate(soon.getDate() + 7)
    const soonISO = soon.toISOString().slice(0, 10)
    let totalVnd = 0, totalUsd = 0
    contracts.forEach(c => {
      const amt = parseFloat(c.amount_after_vat) || 0
      const rate = parseFloat(c.exchange_rate) || 1
      totalVnd += c.currency_code === 'VND' ? amt : amt * rate
      if (c.currency_code === 'USD') totalUsd += amt
    })
    const upcomingCount = items.filter(i => i.due_date && i.due_date <= soonISO).length

    await attachUnread(items, userId)

    return {
      summary: { contractCount: contracts.length, totalVnd, totalUsd, upcomingCount },
      items,
    }
    })
    res.json(payload)
  } catch (err) {
    console.error('getPMDashboard:', err)
    res.status(500).json({ error: 'Không thể tải dashboard PM' })
  }
}

// GET /api/pm/:userId/assigned-tasks
// Dành cho người dùng KHÔNG tham gia dự án nào (không là thành viên HĐ): vẫn thấy
// các công việc được giao trực tiếp cho mình (contract_task.assigned_to). Trả về
// cùng định dạng item như getPMDashboard (source_type='task') để tái dùng bảng theo
// dõi + ghim/nhắc/chuông ở frontend. Ghim/nhắc dùng chung pm_dashboard_tracking.
export async function getAssignedTasks(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId không hợp lệ' })
  try {
    const payload = await cacheWrap(assignedTasksKey(userId), DASH_TTL, async () => {
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.contract_out_id, co.contract_no,
              tr.pinned, tr.remind_at
         FROM contract_task t
         JOIN contract_out co ON co.id = t.contract_out_id
         LEFT JOIN pm_dashboard_tracking tr
                ON tr.user_id = $1 AND tr.source_type = 'task' AND tr.source_id = t.id
        WHERE t.assigned_to = $1
          AND t.status NOT IN ('Hoàn thành', 'Completed', 'Đã hủy', 'Cancelled')
          AND COALESCE(co.is_deleted, false) = false`, [userId])

    const items = rows.map(t => ({
      source_type: 'task', source_id: t.id, side: 'Bán',
      contract_id: t.contract_out_id, contract_no: t.contract_no,
      due_date: iso(t.due_date),
      title: t.title || 'Công việc', sub: 'Hạn hoàn thành', kind: 'Công việc',
      pinned: t.pinned || false,
      remind_at: t.remind_at ? iso(t.remind_at) : null,
    }))

    // Việc của module KT Cơ điện được giao trực tiếp cho user (không gắn hợp đồng).
    const dw = await pool.query(
      `SELECT t.id, t.title, t.due_date, tr.pinned, tr.remind_at
         FROM dept_work_task t
         JOIN dept_work_assignment a
           ON a.task_id = t.id AND a.is_active AND a.assignee_id = $1 AND a.accept_state <> 'rejected'
         LEFT JOIN pm_dashboard_tracking tr
           ON tr.user_id = $1 AND tr.source_type = 'dept_work_task' AND tr.source_id = t.id
        WHERE t.status NOT IN ('Hoàn thành', 'Hủy')`, [userId])
    const dwItems = dw.rows.map(t => ({
      source_type: 'dept_work_task', source_id: t.id, side: 'Phòng',
      contract_id: null, contract_no: null,
      due_date: iso(t.due_date),
      title: t.title || 'Công việc', sub: 'KT Cơ điện', kind: 'Công việc',
      pinned: t.pinned || false,
      remind_at: t.remind_at ? iso(t.remind_at) : null,
    }))

    // Đầu việc checklist đấu thầu giao trực tiếp cho user. Người được giao có thể không
    // thuộc Ban Đấu thầu nên không thấy gói trong module — gom vào đây để vẫn nắm việc.
    // Mở chi tiết qua trang riêng /viec-dau-thau/:itemId (xem trackingUtils.targetUrl).
    const tc = await pool.query(
      `SELECT i.id, i.title, i.due_date, t.package_name, tr.pinned, tr.remind_at
         FROM tender_checklist_item i
         JOIN tender t ON t.id = i.tender_id
         LEFT JOIN pm_dashboard_tracking tr
           ON tr.user_id = $1 AND tr.source_type = 'tender_checklist' AND tr.source_id = i.id
        WHERE i.assignee_id = $1
          AND i.status NOT IN ('Hoàn thành', 'Hủy')
          AND COALESCE(t.is_deleted, false) = false`, [userId])
    const tcItems = tc.rows.map(t => ({
      source_type: 'tender_checklist', source_id: t.id, side: 'Đấu thầu',
      contract_id: null, contract_no: t.package_name,
      due_date: iso(t.due_date),
      title: t.title || 'Đầu việc', sub: 'Đấu thầu', kind: 'Công việc',
      pinned: t.pinned || false,
      remind_at: t.remind_at ? iso(t.remind_at) : null,
    }))

    const allItems = [...items, ...dwItems, ...tcItems]
    await attachUnread(allItems, userId)
    return { items: allItems }
    })
    res.json(payload)
  } catch (err) {
    console.error('getAssignedTasks:', err)
    res.status(500).json({ error: 'Không thể tải công việc được giao' })
  }
}

// PUT /api/pm/:userId/tracking  — body: { source_type, source_id, pinned, remind_at }
// Frontend gửi trạng thái mong muốn ĐẦY ĐỦ của dòng (cả pinned lẫn remind_at).
export async function upsertTracking(req, res) {
  const userId = parseInt(req.params.userId)
  const { source_type, source_id, pinned, remind_at } = req.body
  if (!userId || !source_type || !source_id) return res.status(400).json({ error: 'Thiếu tham số' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO pm_dashboard_tracking (user_id, source_type, source_id, pinned, remind_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id, source_type, source_id) DO UPDATE SET
         pinned = $4, remind_at = $5, updated_at = now()
       RETURNING source_type, source_id, pinned, remind_at`,
      [userId, source_type, parseInt(source_id), !!pinned, remind_at || null])
    // Ghim/nhắc đổi → dashboard của chính user (pinned/remind_at nhúng trong payload đã cache).
    invalidateUserDashboards(userId)
    res.json(rows[0])
  } catch (err) {
    console.error('upsertTracking:', err)
    res.status(500).json({ error: 'Không thể lưu ghim/nhắc' })
  }
}
