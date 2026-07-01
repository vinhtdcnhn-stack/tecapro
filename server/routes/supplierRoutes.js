import { Router } from 'express'
import * as c from '../controllers/supplierController.js'
import { requirePermission } from '../auth/permissions.js'

const router = Router()

// Danh mục NCC dùng chung mọi HĐ: ghi cần system.suppliers.manage
router.get('/suppliers',              c.getAllSuppliers)
router.get('/suppliers/:id',          c.getSupplierById)
router.post('/suppliers',             requirePermission('system.suppliers.manage'), c.createSupplier)
router.put('/suppliers/:id',          requirePermission('system.suppliers.manage'), c.updateSupplier)
router.post('/suppliers/check-code',  requirePermission('system.suppliers.manage'), c.checkSupplierCodeExists)

export default router
