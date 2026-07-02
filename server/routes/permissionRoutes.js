import { Router } from 'express'
import { requirePermission } from '../auth/permissions.js'
import {
  getCatalog, getForPage,
  getGlobalMatrix, putGlobalMatrix,
  getDepartmentMatrix, putDepartmentMatrix,
  getPositionMembers, addPositionMember, removePositionMember,
  getContractMatrix, putContractMatrix,
  getUserOverrides, putUserOverrides,
} from '../controllers/permissionController.js'

const router = Router()

// Toàn bộ module Phân quyền chỉ cho người có quyền cấu hình (mặc định admin-only).
router.use('/permissions', requirePermission('system.permissions.manage'))

router.get('/permissions/catalog', getCatalog)
router.get('/permissions/for-page', getForPage)
router.get('/permissions/global-matrix', getGlobalMatrix)
router.put('/permissions/global-matrix', putGlobalMatrix)
router.get('/permissions/department-matrix', getDepartmentMatrix)
router.put('/permissions/department-matrix', putDepartmentMatrix)
router.get('/permissions/position-members', getPositionMembers)
router.post('/permissions/position-members', addPositionMember)
router.delete('/permissions/position-members', removePositionMember)
router.get('/permissions/contract-matrix', getContractMatrix)
router.put('/permissions/contract-matrix', putContractMatrix)
router.get('/permissions/user-overrides', getUserOverrides)
router.put('/permissions/user-overrides', putUserOverrides)

export default router
