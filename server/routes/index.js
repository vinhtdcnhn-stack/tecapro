import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import customerRoutes from './customerRoutes.js'
import contractRoutes from './contractRoutes.js'

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

export default router
