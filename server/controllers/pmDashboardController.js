import { pool } from '../db.js'
import { computeForecasts } from '../utils/progressForecast.js'

const iso = (v) => (v ? String(v).slice(0, 10) : null)
const todayISO = () => new Date(new Date().toDateString()).toISOString().slice(0, 10)
const emptySummary = () => ({ contractCount: 0, totalVnd: 0, totalUsd: 0, upcomingCount: 0 })

function fmtMoney(n, cur = 'VND') {
  const num = parseFloat(n) || 0
  if (cur === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(num))
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num)
}

// GET /api/pm/:userId/dashboard
export async function getPMDashboard(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId không hợp lệ' })
  try {
    // 1+2. Các HĐ (chưa xóa) mà user là PM — gồm cả PM team, không chỉ primary
    const { rows: contracts } = await pool.query(
      `SELECT DISTINCT co.id, co.contract_no, co.project_name, co.contract_date,
              co.amount_after_vat, co.currency_code, co.exchange_rate
         FROM contract_out co
         JOIN contract_out_member m ON m.contract_out_id = co.id
                                   AND m.member_role = 'PM' AND m.user_id = $1
        WHERE COALESCE(co.is_deleted, false) = false`, [userId])
    const ids = contracts.map(c => c.id)
    if (!ids.length) return res.json({ summary: emptySummary(), items: [] })
    // Key theo String vì contract_out.id (bigint→chuỗi) vs *.contract_out_id (integer→số) khác kiểu
    const cmap = new Map(contracts.map(c => [String(c.id), c]))
    const getC = (cid) => cmap.get(String(cid))

    // 3. Ghim & nhắc của user
    const { rows: trk } = await pool.query(
      'SELECT source_type, source_id, pinned, remind_at FROM pm_dashboard_tracking WHERE user_id = $1', [userId])
    const tmap = new Map(trk.map(t => [`${t.source_type}:${t.source_id}`, t]))
    const attach = (it) => {
      const t = tmap.get(`${it.source_type}:${it.source_id}`)
      return { side: 'Bán', ...it, pinned: t?.pinned || false, remind_at: t?.remind_at ? iso(t.remind_at) : null }
    }

    const items = []

    // ── Biên bản: thời hạn = Ngày dự kiến (forecast), chỉ mốc chưa ký ──
    const { rows: prog } = await pool.query(
      `SELECT p.*, t.code AS bb_code, t.name AS bb_name
         FROM contract_out_progress p
         LEFT JOIN contract_bb_type t ON t.id = p.bb_type_id
        WHERE p.contract_out_id = ANY($1)
        ORDER BY p.contract_out_id, p.sort_order, p.id`, [ids])
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
    const { rows: recv } = await pool.query(
      `SELECT r.id, r.contract_out_id, r.description, r.due_date, r.amount, r.currency_code,
              COALESCE((SELECT SUM(amount) FROM contract_receivable_payment pm
                         WHERE pm.schedule_id = r.id), 0) AS paid
         FROM contract_receivable r
        WHERE r.contract_out_id = ANY($1) AND r.due_date IS NOT NULL`, [ids])
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
    const { rows: guar } = await pool.query(
      `SELECT id, contract_out_id, guarantee_type, expiry_date
         FROM contract_guarantee
        WHERE contract_out_id = ANY($1) AND expiry_date IS NOT NULL
          AND COALESCE(status, '') <> 'Đã giải tỏa'`, [ids])
    guar.forEach(g => {
      const c = getC(g.contract_out_id)
      items.push(attach({
        source_type: 'guarantee', source_id: g.id, contract_id: g.contract_out_id,
        contract_no: c?.contract_no, due_date: iso(g.expiry_date),
        title: g.guarantee_type || 'Bảo lãnh', sub: 'Hết hiệu lực', kind: 'Bảo lãnh',
      }))
    })

    // ── Công việc triển khai: thời hạn = due_date, chỉ việc chưa xong ──
    const { rows: tasks } = await pool.query(
      `SELECT id, contract_out_id, title, due_date
         FROM contract_task
        WHERE contract_out_id = ANY($1) AND due_date IS NOT NULL
          AND status NOT IN ('Hoàn thành', 'Completed', 'Đã hủy', 'Cancelled')`, [ids])
    tasks.forEach(t => {
      const c = getC(t.contract_out_id)
      items.push(attach({
        source_type: 'task', source_id: t.id, contract_id: t.contract_out_id,
        contract_no: c?.contract_no, due_date: iso(t.due_date),
        title: t.title || 'Công việc', sub: 'Hạn hoàn thành', kind: 'Công việc',
      }))
    })

    // ════════ NGUỒN PHÍA NHẬP — HĐ nhập thuộc các HĐ bán mà user là PM ════════
    const { rows: inContracts } = await pool.query(
      'SELECT id, contract_no, contract_out_id, contract_date FROM contract_in WHERE contract_out_id = ANY($1)', [ids])
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
          due_date: iso(due_date), title, kind,
          sub: `HĐ nhập ${ci?.contract_no || ''}${sub ? ' · ' + sub : ''}`.trim(),
        }))
      }

      // Biên bản nhập — planned_date, chỉ mốc chưa ký
      const { rows: inProg } = await pool.query(
        `SELECT p.id, p.contract_in_id, p.planned_date, t.code AS bb_code, t.name AS bb_name
           FROM contract_in_progress p
           LEFT JOIN contract_bb_type t ON t.id = p.bb_type_id
          WHERE p.contract_in_id = ANY($1) AND p.actual_date IS NULL AND p.planned_date IS NOT NULL`, [inIds])
      inProg.forEach(p => pushIn({
        source_type: 'in_progress', source_id: p.id, contract_in_id: p.contract_in_id,
        due_date: p.planned_date, kind: 'Biên bản',
        title: [p.bb_code, p.bb_name].filter(Boolean).join(' – ') || 'Biên bản nhập',
      }))

      // Công nợ phải trả NCC — due_date; bỏ HĐ đã trả đủ (tính theo tổng HĐ nhập)
      const { rows: payRows } = await pool.query(
        'SELECT id, contract_in_id, description, due_date, amount, currency_code FROM contract_in_payable WHERE contract_in_id = ANY($1) AND due_date IS NOT NULL', [inIds])
      const { rows: paySum } = await pool.query(
        'SELECT contract_in_id, SUM(amount) AS total FROM contract_in_payable WHERE contract_in_id = ANY($1) GROUP BY contract_in_id', [inIds])
      const { rows: paidSum } = await pool.query(
        'SELECT contract_in_id, SUM(amount) AS paid FROM contract_in_payment WHERE contract_in_id = ANY($1) GROUP BY contract_in_id', [inIds])
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
      const { rows: deliv } = await pool.query(
        `SELECT id, contract_in_id, batch_name, receive_date FROM contract_in_delivery
          WHERE contract_in_id = ANY($1) AND receive_date IS NOT NULL
            AND COALESCE(status,'') <> 'Đã nhận đủ'`, [inIds])
      deliv.forEach(d => pushIn({
        source_type: 'in_delivery', source_id: d.id, contract_in_id: d.contract_in_id,
        due_date: d.receive_date, kind: 'Nhận hàng',
        title: d.batch_name || 'Đợt nhận hàng', sub: 'Ngày nhận dự kiến',
      }))

      // Logistics / hải quan — ETA (hoặc ETD), chưa thông quan
      const { rows: customs } = await pool.query(
        `SELECT id, contract_in_id, declaration_no, bl_awb_no, etd, eta, customs_status
           FROM contract_in_customs
          WHERE contract_in_id = ANY($1) AND (eta IS NOT NULL OR etd IS NOT NULL)
            AND COALESCE(customs_status,'') <> 'Đã thông quan'`, [inIds])
      customs.forEach(cs => pushIn({
        source_type: 'in_customs', source_id: cs.id, contract_in_id: cs.contract_in_id,
        due_date: cs.eta || cs.etd, kind: 'Logistics',
        title: `Lô ${cs.bl_awb_no || cs.declaration_no || ''}`.trim() || 'Lô hàng nhập',
        sub: cs.eta ? 'ETA (dự kiến đến)' : 'ETD (dự kiến đi)',
      }))

      // Bảo lãnh nhập — expiry_date
      const { rows: inGuar } = await pool.query(
        `SELECT id, contract_in_id, guarantee_type, expiry_date FROM contract_in_guarantee
          WHERE contract_in_id = ANY($1) AND expiry_date IS NOT NULL
            AND COALESCE(status,'') <> 'Đã giải tỏa'`, [inIds])
      inGuar.forEach(g => pushIn({
        source_type: 'in_guarantee', source_id: g.id, contract_in_id: g.contract_in_id,
        due_date: g.expiry_date, kind: 'Bảo lãnh',
        title: g.guarantee_type || 'Bảo lãnh nhập', sub: 'Hết hiệu lực',
      }))

      // Bảo hành NCC — warranty_end
      const { rows: supW } = await pool.query(
        `SELECT id, contract_in_id, item_name, warranty_end FROM contract_in_supplier_warranty
          WHERE contract_in_id = ANY($1) AND warranty_end IS NOT NULL`, [inIds])
      supW.forEach(w => pushIn({
        source_type: 'in_warranty', source_id: w.id, contract_in_id: w.contract_in_id,
        due_date: w.warranty_end, kind: 'Bảo hành NCC',
        title: w.item_name || 'Bảo hành NCC', sub: 'Hết bảo hành NCC',
      }))
    }

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

    res.json({
      summary: { contractCount: contracts.length, totalVnd, totalUsd, upcomingCount },
      items,
    })
  } catch (err) {
    console.error('getPMDashboard:', err)
    res.status(500).json({ error: 'Không thể tải dashboard PM' })
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
    res.json(rows[0])
  } catch (err) {
    console.error('upsertTracking:', err)
    res.status(500).json({ error: 'Không thể lưu ghim/nhắc' })
  }
}
