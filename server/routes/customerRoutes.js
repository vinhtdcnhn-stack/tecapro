import { Router } from 'express'
import * as customerController from '../controllers/customerController.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// Customer routes — danh mục dùng chung mọi HĐ: ghi chỉ admin
router.get('/customers', customerController.getAllCustomers)
router.get('/customers/:id', customerController.getCustomerById)
router.post('/customers', requireAdmin, customerController.createCustomer)
router.put('/customers/:id', requireAdmin, customerController.updateCustomer)
router.post('/customers/check-code', requireAdmin, customerController.checkCodeExists)

export default router
