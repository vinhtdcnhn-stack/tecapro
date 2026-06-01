import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import customerRoutes from './customerRoutes.js'
import contractRoutes from './contractRoutes.js'
import documentRoutes from './documentRoutes.js'
import boqRoutes from './boqRoutes.js'
import progressRoutes from './progressRoutes.js'
import receivableRoutes from './receivableRoutes.js'
import guaranteeRoutes from './guaranteeRoutes.js'
import taskRoutes from './taskRoutes.js'
import supplierRoutes from './supplierRoutes.js'
import warrantyRoutes from './warrantyRoutes.js'
import contractInRoutes from './contractInRoutes.js'
import contractInBOQRoutes from './contractInBOQRoutes.js'
import contractInDeliveryRoutes from './contractInDeliveryRoutes.js'
import contractInPayableRoutes from './contractInPayableRoutes.js'
import supplierWarrantyRoutes from './supplierWarrantyRoutes.js'
import contractInGuaranteeRoutes from './contractInGuaranteeRoutes.js'
import contractInCustomsRoutes from './contractInCustomsRoutes.js'
import contractInLogisticsRoutes from './contractInLogisticsRoutes.js'

const router = Router()

// Auth routes
router.post('/auth/login', authController.login)
router.post('/auth/seed', authController.seedAdmin)

// User routes
router.get('/users', authController.getAllUsers)
router.get('/users/:id', authController.getUserById)
router.get('/me/:id', authController.getUserById) // Alias for user info
router.post('/users', authController.createUser)
router.put('/users/:id', authController.updateUser)
router.post('/users/check-email', authController.checkEmailExists)
router.post('/users/check-username', authController.checkUsernameExists)
router.post('/users/check-employee-code', authController.checkEmployeeCodeExists)

// Department routes
router.get('/departments', authController.getAllDepartments)

// Position routes
router.get('/positions', authController.getAllPositions)

// Manager routes
router.get('/managers', authController.getAllManagers)

// Customer routes
router.use('/customers', customerRoutes)

// Contract routes
router.use('/contracts', contractRoutes)

// Document routes
router.use('/', documentRoutes)

// BOQ routes
router.use('/', boqRoutes)

// Progress routes
router.use('/', progressRoutes)

// Receivable routes
router.use('/', receivableRoutes)

// Guarantee routes
router.use('/', guaranteeRoutes)

// Task routes
router.use('/', taskRoutes)

// Supplier routes
router.use('/', supplierRoutes)

// Warranty routes
router.use('/', warrantyRoutes)

// Contract In routes
router.use('/', contractInRoutes)

// Contract In BOQ routes
router.use('/', contractInBOQRoutes)

// Contract In Delivery routes
router.use('/', contractInDeliveryRoutes)

// Contract In Payable routes
router.use('/', contractInPayableRoutes)

// Supplier Warranty routes
router.use('/', supplierWarrantyRoutes)

// Contract In Guarantee routes
router.use('/', contractInGuaranteeRoutes)

// Contract In Customs (Import/Export) routes
router.use('/', contractInCustomsRoutes)

// Contract In Logistics routes
router.use('/', contractInLogisticsRoutes)

export default router
