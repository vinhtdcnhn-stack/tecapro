import { pool } from '../db.js'
import { vnToday } from '../utils/reportLoaders.js'
import { diffDays } from '../utils/receivableDue.js'
import { cacheWrap } from '../cache.js'
import { reportKey, reportNotModified } from '../services/cacheKeys.js'

const REPORT_TTL = 2 * 60 * 60 // 2h — nhóm 'warranty', invalidate khi equipment/case đổi

// #10 — Báo cáo tình trạng bảo hành (đọc-only). KHÔNG có trường BH cấp HĐ: roll-up từ
// dữ liệu BH theo từng thiết bị (contract_equipment.warranty_from/to). Trạng thái HĐ
// theo ngày hết BH MUỘN NHẤT của các thiết bị: còn / sắp hết (≤30 ngày) / hết.
const iso = (v) => (v ? String(v).slice(0, 10) : null)
const RESOLVED = new Set(['Hoàn thành', 'Đóng'])

export async function getWarrantyReport(req, res) {
  try {
    if (await reportNotModified(req, res, 'warranty')) return
    const today = vnToday()
    const key = await reportKey('warranty', 'warranty', { asOf: today })
    const payload = await cacheWrap(key, REPORT_TTL, async () => {

    // Thiết bị có ngày hết BH + ngữ cảnh hợp đồng.
    const { rows: eq } = await pool.query(`
      SELECT e.id, e.contract_out_id, e.name, e.warranty_from, e.warranty_to,
             c.contract_no, c.contract_date, cu.name AS customer_name
        FROM contract_equipment e
        JOIN contract_out c ON c.id = e.contract_out_id AND COALESCE(c.is_deleted, false) = false
        LEFT JOIN customer cu ON cu.id = c.customer_id
       WHERE e.warranty_to IS NOT NULL
       ORDER BY e.contract_out_id, e.warranty_to`)

    // Gom theo hợp đồng.
    const byContract = new Map()
    for (const e of eq) {
      const k = String(e.contract_out_id)
      if (!byContract.has(k)) byContract.set(k, {
        contract_out_id: e.contract_out_id, contract_no: e.contract_no,
        customer_name: e.customer_name, contract_date: iso(e.contract_date), devices: [],
      })
      const expiry = iso(e.warranty_to)
      const left = diffDays(today, expiry)   // >0 còn hạn, <0 hết
      byContract.get(k).devices.push({
        id: e.id, name: e.name, warranty_from: iso(e.warranty_from), warranty_to: expiry,
        status: left < 0 ? 'Hết hiệu lực' : (left <= 30 ? 'Sắp hết hạn' : 'Còn hiệu lực'),
      })
    }

    const contracts = [...byContract.values()].map(c => {
      const exps = c.devices.map(d => d.warranty_to).filter(Boolean).sort()
      const earliest = exps[0] || null
      const latest = exps[exps.length - 1] || null
      const valid = c.devices.filter(d => d.warranty_to >= today).length
      const expired = c.devices.length - valid
      const status = !latest ? '—'
        : latest < today ? 'Hết hiệu lực'
        : diffDays(today, latest) <= 30 ? 'Sắp hết hạn' : 'Còn hiệu lực'
      return {
        ...c, earliest_expiry: earliest, latest_expiry: latest,
        device_count: c.devices.length, valid_count: valid, expired_count: expired, status,
      }
    }).sort((a, b) => (a.latest_expiry || '').localeCompare(b.latest_expiry || ''))

    // I. Tổng hợp.
    const summary = {
      contracts_with_warranty: contracts.length,
      still_valid: contracts.filter(c => c.status !== 'Hết hiệu lực' && c.status !== '—').length,
      expiring_30d: contracts.filter(c => c.status === 'Sắp hết hạn').length,
      expired: contracts.filter(c => c.status === 'Hết hiệu lực').length,
    }

    // Yêu cầu bảo hành.
    const { rows: caseRows } = await pool.query(
      `SELECT wc.id, wc.case_no, wc.title, wc.reported_by, wc.reported_date, wc.resolved_date, wc.status,
              wc.contract_out_id, c.contract_no
         FROM warranty_case wc
         JOIN contract_out c ON c.id = wc.contract_out_id
        ORDER BY wc.reported_date DESC NULLS LAST, wc.id DESC`)
    const total = caseRows.length
    const resolved = caseRows.filter(c => RESOLVED.has(c.status) || c.resolved_date).length
    summary.total_cases = total
    summary.resolved_cases = resolved
    summary.processing_cases = total - resolved
    summary.resolved_ratio = total > 0 ? resolved / total : 0
    summary.avg_cases_per_contract = contracts.length > 0 ? total / contracts.length : 0

    // Top 10 sản phẩm/dịch vụ phát sinh lỗi nhiều nhất.
    const { rows: top } = await pool.query(`
      SELECT e.name, COUNT(*)::int AS n
        FROM warranty_case_equipment ce
        JOIN contract_equipment e ON e.id = ce.equipment_id
       GROUP BY e.name ORDER BY n DESC, e.name LIMIT 10`)

    return {
      asOf: today, summary, top_products: top,
      contracts,
      cases: caseRows.map(c => ({
        id: c.id, case_no: c.case_no, title: c.title,
        contract_out_id: c.contract_out_id, contract_no: c.contract_no,
        reported_by: c.reported_by, reported_date: iso(c.reported_date),
        resolved_date: iso(c.resolved_date), status: c.status,
        resolved: RESOLVED.has(c.status) || !!c.resolved_date,
      })),
    }
    })
    res.json(payload)
  } catch (err) {
    console.error('getWarrantyReport:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo bảo hành.' })
  }
}
