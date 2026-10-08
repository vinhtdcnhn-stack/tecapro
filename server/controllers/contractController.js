import { pool } from '../db.js'
import { cacheWrap } from '../cache.js'
import { loadGlobalPermissions } from '../auth/permissions.js'
import {
  contractKey, contractListKey, contractTabNotModified, versionNotModified,
} from '../services/cacheKeys.js'

// Ghi HĐ (tạo/sửa/kiểm tra trùng số/đổi trạng thái Hoàn thành) tách sang
// contractWriteController.js — re-export để routes cũ không phải đổi import.
export {
  checkContractNoDuplicate, createContract, updateContract, setContractStatus,
} from './contractWriteController.js'

const INFO_TTL = 30 * 60      // tab thông tin HĐ
const LIST_TTL = 10 * 60      // danh sách HĐ (per-user)

export async function getAllContracts(req, res) {
  try {
    // Xác thực nhẹ: danh sách per-user nhưng version 'contract-list' là toàn cục (bump khi
    // bất kỳ HĐ/thành viên đổi) → 304 an toàn (xem versionNotModified). Client xóa kho điều
    // kiện khi đăng xuất nên không rò body giữa các user trên cùng tab.
    if (await versionNotModified(req, res, 'contract-list', 'clist')) return
    // Phân quyền xem danh sách dựa trên danh tính đã xác thực (req.user từ cookie phiên),
    // KHÔNG dựa vào tham số client tự truyền: admin (role=1) xem tất cả, còn lại xem
    // mọi HĐ mình được phân công BẤT KỲ vai trò nào (PM/sale/presale/kỹ thuật/kế toán/
    // người theo dõi) — tức toàn bộ dự án mình tham gia.
    const restrictMemberUserId = Number(req.user?.role) === 1 ? null : (req.user?.id ?? null)

    const listKey = await contractListKey(restrictMemberUserId ?? 'all')
    const rows = await cacheWrap(listKey, LIST_TTL, async () => {
    const params = []
    let memberFilter = ''
    if (restrictMemberUserId) {
      params.push(restrictMemberUserId)
      memberFilter = `
      AND EXISTS (
        SELECT 1 FROM contract_out_member m
        WHERE m.contract_out_id = co.id AND m.user_id = $1
      )`
    }

    const sql = `
      SELECT DISTINCT ON (co.id)
        co.id,
        co.contract_no,
        co.project_name,
        c.name AS customer_name,
        co.contract_date,
        co.tender_name,
        co.amount_before_vat,
        co.amount_after_vat,
        co.currency_code,
        co.exchange_rate,
        co.is_joint_venture,
        COALESCE(au.full_name, '-') AS pm_name,
        co.status
      FROM contract_out co
      LEFT JOIN customer c ON c.id = co.customer_id
      LEFT JOIN (
        SELECT
          com.contract_out_id,
          com.user_id,
          com.role_rank,
          ROW_NUMBER() OVER (PARTITION BY com.contract_out_id ORDER BY com.role_rank ASC) as rn
        FROM contract_out_member com
        WHERE com.member_role = 'PM' AND com.is_primary = true
      ) com ON com.contract_out_id = co.id AND com.rn = 1
      LEFT JOIN app_user au ON au.id = com.user_id
      WHERE COALESCE(co.is_deleted, false) = false
      ${memberFilter}
      ORDER BY co.id, co.contract_date DESC
    `

    const result = await pool.query(sql, params)
    return result.rows
    })

    // Ẩn giá trị tiền server-side nếu user thiếu quyền module.contracts.amounts (admin luôn có).
    // Strip SAU cacheWrap (cache lưu bản đầy đủ) để bản trả về đúng theo quyền từng user.
    const gk = await loadGlobalPermissions(req.user.id, req.user.role)
    if (!gk.includes('module.contracts.amounts')) {
      const stripped = rows.map(r => ({
        ...r, amount_before_vat: null, amount_after_vat: null, currency_code: null, exchange_rate: null,
      }))
      res.json(stripped)
      return
    }
    res.json(rows)
  } catch (err) {
    console.error('Failed to load contracts:', err)
    res.status(500).json({ error: 'Không thể tải danh sách hợp đồng' })
  }
}

export async function getContractById(req, res) {
  try {
    const contractId = parseInt(req.params.id)

    if (await contractTabNotModified(req, res, contractId, 'info')) return
    const payload = await cacheWrap(contractKey(contractId, 'info'), INFO_TTL, async () => {
    // Get contract basic info
    const contractSql = `
      SELECT
        co.id,
        co.contract_no,
        co.project_name,
        c.name AS customer_name,
        c.id AS customer_id,
        co.contract_date,
        co.tender_name,
        co.amount_before_vat,
        co.amount_after_vat,
        co.currency_code,
        co.exchange_rate,
        co.payment_term AS terms,
        co.is_joint_venture,
        co.status,
        co.boq_locked,
        co.boq_locked_at,
        co.boq_warranty_bb_id,
        co.boq_warranty_months,
        lu.full_name AS boq_locked_by_name
      FROM contract_out co
      LEFT JOIN customer c ON c.id = co.customer_id
      LEFT JOIN app_user lu ON lu.id = co.boq_locked_by
      WHERE co.id = $1 AND COALESCE(co.is_deleted, false) = false
    `
    
    const contractResult = await pool.query(contractSql, [contractId])

    if (contractResult.rows.length === 0) return null

    const contract = contractResult.rows[0]
    
    // Get all members grouped by role
    const membersSql = `
      SELECT
        com.member_role,
        au.full_name,
        au.id as user_id,
        com.is_primary
      FROM contract_out_member com
      LEFT JOIN app_user au ON au.id = com.user_id
      WHERE com.contract_out_id = $1
      ORDER BY com.role_rank, au.full_name
    `
    
    const membersResult = await pool.query(membersSql, [contractId])
    
    // Group members by role
    const saleMembers = []
    const pmMembers = []
    const presaleMembers = []
    const technicalMembers = []
    const importExportMembers = []
    const accountingMembers = []
    const followerMembers = []

    const saleMemberIds = []
    const pmMemberIds = []
    const presaleMemberIds = []
    const technicalMemberIds = []
    const importExportMemberIds = []
    const accountingMemberIds = []
    const followerMemberIds = []
    
    let pmPrimaryId = null
    
    membersResult.rows.forEach(member => {
      const fullName = member.full_name || '-'
      const userId = member.user_id
      const role = String(member.member_role || '').toUpperCase()
      const isPrimary = member.is_primary

      switch (role) {
        case 'SALE':
          saleMembers.push(fullName)
          if (userId) saleMemberIds.push(userId)
          break

        case 'PM':
          pmMembers.push(fullName)
          if (userId) pmMemberIds.push(userId)
          if (isPrimary && userId) {
            pmPrimaryId = userId
          }
          break

        case 'PRESALE':
          presaleMembers.push(fullName)
          if (userId) presaleMemberIds.push(userId)
          break

        case 'TECHNICAL':
          technicalMembers.push(fullName)
          if (userId) technicalMemberIds.push(userId)
          break

        case 'IMPORTEXPORT':
          importExportMembers.push(fullName)
          if (userId) importExportMemberIds.push(userId)
          break

        case 'ACCOUNTANT':
        case 'ACCOUNTING':
          accountingMembers.push(fullName)
          if (userId) accountingMemberIds.push(userId)
          break

        case 'FOLLOWER':
          followerMembers.push(fullName)
          if (userId) followerMemberIds.push(userId)
          break
      }
    })
    
    return {
      ...contract,
      sale_members: saleMembers,
      sale_member_ids: saleMemberIds,
      pm_members: pmMembers,
      pm_member_ids: pmMemberIds,
      pm_primary_id: pmPrimaryId,
      presale_members: presaleMembers,
      presale_member_ids: presaleMemberIds,
      technical_members: technicalMembers,
      technical_member_ids: technicalMemberIds,
      import_export_members: importExportMembers,
      import_export_member_ids: importExportMemberIds,
      accounting_members: accountingMembers,
      accounting_member_ids: accountingMemberIds,
      follower_members: followerMembers,
      follower_member_ids: followerMemberIds
    }
    })

    if (!payload) {
      res.status(404).json({ error: 'Không tìm thấy hợp đồng' })
      return
    }
    res.json(payload)
  } catch (err) {
    console.error('Failed to load contract details:', err)
    res.status(500).json({ error: 'Không thể tải thông tin hợp đồng' })
  }
}
