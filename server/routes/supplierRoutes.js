import { Router } from 'express'
import * as c from '../controllers/supplierController.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// Danh mục NCC dùng chung mọi HĐ: ghi chỉ admin
router.get('/suppliers',              c.getAllSuppliers)
router.get('/suppliers/:id',          c.getSupplierById)
router.post('/suppliers',             requireAdmin, c.createSupplier)
router.put('/suppliers/:id',          requireAdmin, c.updateSupplier)
router.post('/suppliers/check-code',  requireAdmin, c.checkSupplierCodeExists)

export default router
