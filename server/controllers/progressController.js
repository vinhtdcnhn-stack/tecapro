import { pool } from '../db.js'
import { activateReadyTasksSafe } from '../services/taskAutoStart.js'
import { cacheWrap } from '../cache.js'
import {
  lookupKey, invalidateLookup, contractKey, contractInKey,
  contractTabNotModified, contractInTabNotModified,
  invalidateContract, invalidateContractIn, invalidateContractMembers,
  invalidateContractInMembers, invalidateReports, lookupNotModified,
} from '../services/cacheKeys.js'
import { rejectIfStale } from '../utils/staleGuard.js'

const BB_TTL = 24 * 60 * 60      // loại biên bản: danh mục ít đổi
const TAB_TTL = 30 * 60         // tab chi tiết HĐ: 30'

// ── BB Type master ────────────────────────────────────────────────────────────

export async function getBBTypes(req, res) {
  try {
    if (await lookupNotModified(req, res, 'bb-types')) return
    const rows = await cacheWrap(lookupKey('bb-types'), BB_TTL, async () => {
      const { rows } = await pool.query(
        'SELECT * FROM public.contract_bb_type WHERE is_active = true ORDER BY sort_order, id'
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getBBTypes:', err)
    res.status(500).json({ error: 'Failed to get BB types' })
  }
}

export async function createBBType(req, res) {
  try {
    const { code, name } = req.body
    if (!code?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'Code và tên là bắt buộc' })
    }

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_bb_type'
    )
    const { rows } = await pool.query(
      'INSERT INTO public.contract_bb_type (code, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [code.trim().toUpperCase(), name.trim(), Number(mx[0].m) + 10]
    )
    invalidateLookup('bb-types')
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Mã loại BB đã tồn tại' })
    console.error('createBBType:', err)
    res.status(500).json({ error: 'Failed to create BB type' })
  }
}

export async function updateBBType(req, res) {
  try {
    const { code, name } = req.body
    const { rows } = await pool.query(
      'UPDATE public.contract_bb_type SET code = $1, name = $2 WHERE id = $3 RETURNING *',
      [code.trim().toUpperCase(), name.trim(), req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidateLookup('bb-types')
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Mã loại BB đã tồn tại' })
    console.error('updateBBType:', err)
    res.status(500).json({ error: 'Failed to update BB type' })
  }
}

export async function deleteBBType(req, res) {
  try {
    // Check if any progress row uses this type
    const { rows: used } = await pool.query(
      'SELECT id FROM public.contract_out_progress WHERE bb_type_id = $1 LIMIT 1',
      [req.params.id]
    )
    if (used.length) {
      return res.status(400).json({ error: 'Loại BB đang được sử dụng, không thể xóa' })
    }
    await pool.query('DELETE FROM public.contract_bb_type WHERE id = $1', [req.params.id])
    invalidateLookup('bb-types')
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteBBType:', err)
    res.status(500).json({ error: 'Failed to delete BB type' })
  }
}

// ── Progress CRUD ─────────────────────────────────────────────────────────────

const PROGRESS_SELECT = `
  SELECT p.*, t.code AS bb_code, t.name AS bb_name
  FROM public.contract_out_progress p
  LEFT JOIN public.contract_bb_type t ON t.id = p.bb_type_id
`

export async function getProgress(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.contractId, 'progress')) return
    const rows = await cacheWrap(contractKey(req.params.contractId, 'progress'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        PROGRESS_SELECT + ' WHERE p.contract_out_id = $1 ORDER BY p.sort_order, p.id',
        [req.params.contractId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getProgress:', err)
    res.status(500).json({ error: 'Failed to get progress' })
  }
}

// Tiến độ đổi → tab progress + dashboard thành viên + báo cáo công nợ (ngày đến hạn neo theo mốc).
function invalidateProgressOut(contractId) {
  invalidateContract(contractId, 'progress')
  invalidateContractMembers(contractId)
  invalidateReports('debt')
}

export async function createProgress(req, res) {
  try {
    const { contractId } = req.params
    const { bb_type_id, planned_date, actual_date, reason, penalty_note,
            offset_days, base_bb_type_id, base_anchor,
            hd_offset_days, hd_base_bb_type_id, hd_base_anchor } = req.body

    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM public.contract_out_progress WHERE contract_out_id = $1',
      [contractId]
    )
    const sortOrder = Number(mx[0].m) + 1

    const { rows } = await pool.query(`
      INSERT INTO public.contract_out_progress
        (contract_out_id, bb_type_id, sort_order, planned_date, actual_date, reason, penalty_note,
         offset_days, base_bb_type_id, base_anchor, hd_offset_days, hd_base_bb_type_id, hd_base_anchor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [contractId, bb_type_id || null, sortOrder,
        planned_date || null, actual_date || null,
        reason || '', penalty_note || '',
        offset_days === '' || offset_days == null ? null : parseInt(offset_days, 10),
        base_bb_type_id || null, base_anchor || null,
        hd_offset_days === '' || hd_offset_days == null ? null : parseInt(hd_offset_days, 10),
        hd_base_bb_type_id || null, hd_base_anchor || null])

    // Re-fetch with type info
    const { rows: full } = await pool.query(
      PROGRESS_SELECT + ' WHERE p.id = $1', [rows[0].id]
    )
    invalidateProgressOut(contractId)
    res.status(201).json(full[0])
  } catch (err) {
    console.error('createProgress:', err)
    res.status(500).json({ error: 'Failed to create progress entry' })
  }
}

export async function updateProgress(req, res) {
  try {
    if (await rejectIfStale(req, res, 'public.contract_out_progress')) return
    const { bb_type_id, planned_date, actual_date, reason, penalty_note,
            offset_days, base_bb_type_id, base_anchor,
            hd_offset_days, hd_base_bb_type_id, hd_base_anchor } = req.body

    const { rows } = await pool.query(`
      UPDATE public.contract_out_progress SET
        bb_type_id      = $1,
        planned_date    = $2,
        actual_date     = $3,
        reason          = $4,
        penalty_note    = $5,
        offset_days     = $6,
        base_bb_type_id = $7,
        base_anchor     = $8,
        hd_offset_days     = $9,
        hd_base_bb_type_id = $10,
        hd_base_anchor     = $11,
        updated_at      = now()
      WHERE id = $12
      RETURNING *
    `, [bb_type_id || null, planned_date || null, actual_date || null,
        reason || '', penalty_note || '',
        offset_days === '' || offset_days == null ? null : parseInt(offset_days, 10),
        base_bb_type_id || null, base_anchor || null,
        hd_offset_days === '' || hd_offset_days == null ? null : parseInt(hd_offset_days, 10),
        hd_base_bb_type_id || null, hd_base_anchor || null,
        req.params.id])

    if (!rows.length) return res.status(404).json({ error: 'Not found' })

    const { rows: full } = await pool.query(
      PROGRESS_SELECT + ' WHERE p.id = $1', [rows[0].id]
    )
    invalidateProgressOut(rows[0].contract_out_id)
    res.json(full[0])

    // Mốc tiến độ vừa có ngày thực tế → mở khóa các công việc phụ thuộc mốc này.
    if (actual_date) activateReadyTasksSafe()
  } catch (err) {
    console.error('updateProgress:', err)
    res.status(500).json({ error: 'Failed to update progress entry' })
  }
}

export async function deleteProgress(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM public.contract_out_progress WHERE id = $1 RETURNING id, contract_out_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidateProgressOut(rows[0].contract_out_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteProgress:', err)
    res.status(500).json({ error: 'Failed to delete progress entry' })
  }
}

// ── Contract_In Progress CRUD ─────────────────────────────────────────────────

const IN_PROGRESS_SELECT = `
  SELECT p.*, t.code AS bb_code, t.name AS bb_name
  FROM contract_in_progress p
  LEFT JOIN public.contract_bb_type t ON t.id = p.bb_type_id
`

export async function getProgressIn(req, res) {
  try {
    if (await contractInTabNotModified(req, res, req.params.contractInId, 'progress')) return
    const rows = await cacheWrap(contractInKey(req.params.contractInId, 'progress'), TAB_TTL, async () => {
      const { rows } = await pool.query(
        IN_PROGRESS_SELECT + ' WHERE p.contract_in_id = $1 ORDER BY p.sort_order, p.id',
        [req.params.contractInId]
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getProgressIn:', err)
    res.status(500).json({ error: 'Không thể tải tiến độ' })
  }
}

// Tiến độ HĐ nhập đổi → tab ci progress + dashboard thành viên HĐ bán cha.
function invalidateProgressIn(contractInId) {
  invalidateContractIn(contractInId, 'progress')
  invalidateContractInMembers(contractInId)
}

export async function createProgressIn(req, res) {
  try {
    const { contractInId } = req.params
    const { bb_type_id, planned_date, actual_date, reason, penalty_note } = req.body
    const { rows: mx } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM contract_in_progress WHERE contract_in_id = $1',
      [contractInId]
    )
    const { rows } = await pool.query(`
      INSERT INTO contract_in_progress
        (contract_in_id, bb_type_id, sort_order, planned_date, actual_date, reason, penalty_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [contractInId, bb_type_id||null, Number(mx[0].m)+1,
       planned_date||null, actual_date||null, reason||'', penalty_note||'']
    )
    const { rows: full } = await pool.query(IN_PROGRESS_SELECT + ' WHERE p.id = $1', [rows[0].id])
    invalidateProgressIn(contractInId)
    res.status(201).json(full[0])
  } catch (err) {
    console.error('createProgressIn:', err)
    res.status(500).json({ error: 'Không thể thêm biên bản' })
  }
}

export async function updateProgressIn(req, res) {
  try {
    if (await rejectIfStale(req, res, 'contract_in_progress')) return
    const { bb_type_id, planned_date, actual_date, reason, penalty_note } = req.body
    const { rows } = await pool.query(`
      UPDATE contract_in_progress SET
        bb_type_id=$1, planned_date=$2, actual_date=$3,
        reason=$4, penalty_note=$5, updated_at=NOW()
      WHERE id=$6 RETURNING *`,
      [bb_type_id||null, planned_date||null, actual_date||null,
       reason||'', penalty_note||'', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    const { rows: full } = await pool.query(IN_PROGRESS_SELECT + ' WHERE p.id = $1', [rows[0].id])
    invalidateProgressIn(rows[0].contract_in_id)
    res.json(full[0])
  } catch (err) {
    console.error('updateProgressIn:', err)
    res.status(500).json({ error: 'Không thể cập nhật' })
  }
}

export async function deleteProgressIn(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM contract_in_progress WHERE id = $1 RETURNING id, contract_in_id',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    invalidateProgressIn(rows[0].contract_in_id)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('deleteProgressIn:', err)
    res.status(500).json({ error: 'Không thể xóa' })
  }
}
