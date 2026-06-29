import { pool } from '../db.js'
import { logActivity } from './tenderController.js'
import { cacheWrap } from '../cache.js'
import { lookupKey, invalidateLookup, invalidateTender, lookupNotModified } from '../services/cacheKeys.js'

const TPL_TTL = 24 * 60 * 60 // 24h — mẫu dùng chung, rất ít đổi

// ──────────────────────────────────────────────────────────────────────────────
// Mẫu checklist công việc dùng chung (1 bộ mặc định cho cả Ban Đấu thầu).
// Quản lý đầu việc mẫu (CRUD, có việc con) + "Áp dụng mẫu" để đổ vào checklist
// của một gói thầu. Mẫu không có người phụ trách/hạn — giao theo từng gói.
// ──────────────────────────────────────────────────────────────────────────────

const TPL_COLS = `
  i.id, i.title, i.description, i.department_id, d.name AS department_name,
  i.parent_item_id, i.sort_order`

export async function getTemplate(req, res) {
  try {
    if (await lookupNotModified(req, res, 'tender-tpl')) return
    const rows = await cacheWrap(lookupKey('tender-tpl'), TPL_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT ${TPL_COLS}
           FROM tender_checklist_template_item i
           LEFT JOIN department d ON d.id = i.department_id
          ORDER BY i.parent_item_id NULLS FIRST, i.sort_order, i.id`,
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getTemplate:', err)
    res.status(500).json({ error: 'Không thể tải mẫu checklist.' })
  }
}

export async function createTemplateItem(req, res) {
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Tên đầu việc không được để trống.' })
  const departmentId = req.body?.department_id ? parseInt(req.body.department_id) : null
  const parentId = req.body?.parent_item_id ? parseInt(req.body.parent_item_id) : null
  const description = String(req.body?.description ?? '').trim() || null
  try {
    const { rows: ord } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM tender_checklist_template_item
        WHERE parent_item_id IS NOT DISTINCT FROM $1`,
      [parentId],
    )
    const { rows } = await pool.query(
      `INSERT INTO tender_checklist_template_item
         (title, description, department_id, parent_item_id, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, description, departmentId, parentId, ord[0].n, req.user.id],
    )
    invalidateLookup('tender-tpl')
    res.status(201).json({ success: true, id: rows[0].id })
  } catch (err) {
    console.error('createTemplateItem:', err)
    res.status(500).json({ error: 'Không thể tạo đầu việc mẫu.' })
  }
}

export async function updateTemplateItem(req, res) {
  const id = parseInt(req.params.itemId)
  const title = String(req.body?.title ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Tên đầu việc không được để trống.' })
  const departmentId = req.body?.department_id ? parseInt(req.body.department_id) : null
  const description = String(req.body?.description ?? '').trim() || null
  try {
    const { rows } = await pool.query(
      `UPDATE tender_checklist_template_item SET
         title=$1, description=$2, department_id=$3, updated_at=now()
       WHERE id=$4 RETURNING id`,
      [title, description, departmentId, id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc mẫu.' })
    invalidateLookup('tender-tpl')
    res.json({ success: true, id: rows[0].id })
  } catch (err) {
    console.error('updateTemplateItem:', err)
    res.status(500).json({ error: 'Không thể cập nhật đầu việc mẫu.' })
  }
}

export async function deleteTemplateItem(req, res) {
  const id = parseInt(req.params.itemId)
  try {
    const { rows } = await pool.query(
      'DELETE FROM tender_checklist_template_item WHERE id = $1 RETURNING id', [id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc mẫu.' })
    invalidateLookup('tender-tpl')
    res.json({ success: true })
  } catch (err) {
    console.error('deleteTemplateItem:', err)
    res.status(500).json({ error: 'Không thể xoá đầu việc mẫu.' })
  }
}

// Đổ toàn bộ mẫu vào checklist của một gói thầu (giữ cây cha–con). Người phụ trách/hạn
// để trống — giao sau. Chèn lặp theo lớp để cha luôn có trước con dù id không liền.
export async function applyTemplate(req, res) {
  const tenderId = parseInt(req.params.id)
  const client = await pool.connect()
  try {
    const { rows: tpl } = await client.query(
      `SELECT id, title, description, department_id, parent_item_id, sort_order
         FROM tender_checklist_template_item
        ORDER BY parent_item_id NULLS FIRST, sort_order, id`,
    )
    if (!tpl.length) return res.status(400).json({ error: 'Mẫu checklist đang trống.' })

    await client.query('BEGIN')
    const idMap = new Map()       // template id → new checklist item id
    const remaining = [...tpl]
    let guard = remaining.length + 1
    while (remaining.length && guard-- > 0) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        const t = remaining[i]
        const parentNew = t.parent_item_id == null ? null : idMap.get(t.parent_item_id)
        if (t.parent_item_id != null && parentNew === undefined) continue  // cha chưa chèn
        const { rows } = await client.query(
          `INSERT INTO tender_checklist_item
             (tender_id, title, description, department_id, parent_item_id, sort_order, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [tenderId, t.title, t.description, t.department_id, parentNew ?? null, t.sort_order, req.user.id],
        )
        idMap.set(t.id, rows[0].id)
        remaining.splice(i, 1)
      }
    }
    await client.query('COMMIT')
    invalidateTender(tenderId, 'checklist')
    logActivity(tenderId, req.user.id, 'update', `Áp dụng mẫu checklist (${idMap.size} đầu việc)`)
    res.json({ success: true, count: idMap.size })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('applyTemplate:', err)
    res.status(500).json({ error: 'Không thể áp dụng mẫu checklist.' })
  } finally {
    client.release()
  }
}
