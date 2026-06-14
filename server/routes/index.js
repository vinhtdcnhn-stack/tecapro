import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import { requireAuth, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.js'
import { loginLimiter } from '../middleware/loginRateLimit.js'
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
import pmDashboardRoutes from './pmDashboardRoutes.js'
import deptWorkRoutes from './deptWorkRoutes.js'

const router = Router()

// ── Route công khai (không yêu cầu đăng nhập) ──
router.post('/auth/login', loginLimiter.guard, authController.login)
router.post('/auth/logout', authController.logout)

// ── Mọi route phía dưới đều yêu cầu đã đăng nhập ──
router.use(requireAuth)

// Thông tin người dùng hiện tại (danh tính lấy từ cookie phiên)
router.get('/auth/me', authController.getCurrentUser)

// User routes
router.get('/users', authController.getAllUsers)
router.get('/users/:id', requireSelfOrAdmin('id'), authController.getUserById)
router.get('/me/:id', requireSelfOrAdmin('id'), authController.getUserById) // Alias for user info
router.post('/users', requireAdmin, authController.createUser)
router.put('/users/:id/change-password', requireSelfOrAdmin('id'), authController.changePassword)
router.put('/users/:id', requireAdmin, authController.updateUser)
router.post('/users/check-email', requireAdmin, authController.checkEmailExists)
router.post('/users/check-username', requireAdmin, authController.checkUsernameExists)
router.post('/users/check-employee-code', requireAdmin, authController.checkEmployeeCodeExists)

// Department routes — danh mục dùng chung: ghi chỉ admin
router.get('/departments', authController.getAllDepartments)
router.post('/departments', requireAdmin, authController.createDepartment)
router.put('/departments/:id', requireAdmin, authController.updateDepartment)

// Position routes — danh mục dùng chung: ghi chỉ admin
router.get('/positions', authController.getAllPositions)
router.post('/positions', requireAdmin, authController.createPosition)
router.put('/positions/:id', requireAdmin, authController.updatePosition)

// Manager routes
router.get('/managers', authController.getAllManagers)

// Customer routes (customerRoutes tự định nghĩa path đầy đủ /customers/...)
router.use('/', customerRoutes)

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

// PM dashboard (trang chủ cho vị trí PM_TEAM)
router.use('/', pmDashboardRoutes)

// Quản lý công việc — Ban KT Cơ điện
router.use('/', deptWorkRoutes)

export default router
