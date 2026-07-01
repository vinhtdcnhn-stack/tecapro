import { Router } from 'express'
import * as customerController from '../controllers/customerController.js'
import { requirePermission } from '../auth/permissions.js'

const router = Router()

// Customer routes — danh mục dùng chung mọi HĐ: ghi cần system.customers.manage
router.get('/customers', customerController.getAllCustomers)
router.get('/customers/:id', customerController.getCustomerById)
router.post('/customers', requirePermission('system.customers.manage'), customerController.createCustomer)
router.put('/customers/:id', requirePermission('system.customers.manage'), customerController.updateCustomer)
router.post('/customers/check-code', requirePermission('system.customers.manage'), customerController.checkCodeExists)

export default router
