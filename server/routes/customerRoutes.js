import { Router } from 'express'
import * as customerController from '../controllers/customerController.js'

const router = Router()

// Customer routes
router.get('/customers', customerController.getAllCustomers)
router.get('/customers/:id', customerController.getCustomerById)
router.post('/customers', customerController.createCustomer)
router.put('/customers/:id', customerController.updateCustomer)
router.post('/customers/check-code', customerController.checkCodeExists)

export default router
