import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import { requireAuth, requireSelfOrAdmin } from '../middleware/auth.js'
import { withAuditActor } from '../middleware/auditActor.js'
import { requirePermission } from '../auth/permissions.js'
import { loginLimiter } from '../middleware/loginRateLimit.js'
import customerRoutes from './customerRoutes.js'
import contractRoutes from './contractRoutes.js'
import documentRoutes from './documentRoutes.js'
import boqRoutes from './boqRoutes.js'
import supplyCoverageRoutes from './supplyCoverageRoutes.js'
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
import tenderRoutes from './tenderRoutes.js'
import approvalRoutes from './approvalRoutes.js'
import reportRoutes from './reportRoutes.js'
import invoiceRoutes from './invoiceRoutes.js'
import liveRoutes from './liveRoutes.js'
import permissionRoutes from './permissionRoutes.js'
import auditRoutes from './auditRoutes.js'
import { listTelegramLogs } from '../controllers/telegramLogController.js'
import {
  listFeedback, createFeedback, updateFeedback, deleteFeedback,
  addFeedbackImage, uploadFeedbackImage,
} from '../controllers/feedbackController.js'
import { createBackup, restoreBackup, uploadRestore } from '../controllers/adminBackupController.js'
import {
  buildUploadsBackup, uploadsJobStatus, listUploadsBackups,
  downloadUploadsBackup, deleteUploadsBackup, restoreUploads,
} from '../controllers/adminUploadsBackupController.js'

const router = Router()

// ── Route công khai (không yêu cầu đăng nhập) ──
router.post('/auth/login', loginLimiter.guard, authController.login)
router.post('/auth/logout', authController.logout)

// ── Mọi route phía dưới đều yêu cầu đã đăng nhập ──
router.use(requireAuth)
// Gắn người thao tác cho nhật ký thay đổi (sau requireAuth → đã có req.user.id).
router.use(withAuditActor)

// Thông tin người dùng hiện tại (danh tính lấy từ cookie phiên)
router.get('/auth/me', authController.getCurrentUser)

// User routes
router.get('/users', authController.getAllUsers)
router.get('/users/:id', requireSelfOrAdmin('id'), authController.getUserById)
router.get('/me/:id', requireSelfOrAdmin('id'), authController.getUserById) // Alias for user info
router.post('/users', requirePermission('system.users.manage'), authController.createUser)
router.put('/users/:id/change-password', requireSelfOrAdmin('id'), authController.changePassword)
router.put('/users/:id/telegram', requireSelfOrAdmin('id'), authController.updateMyTelegram)
router.post('/users/:id/test-telegram', requireSelfOrAdmin('id'), authController.testTelegram)
router.put('/users/:id', requirePermission('system.users.manage'), authController.updateUser)
router.post('/users/check-email', requirePermission('system.users.manage'), authController.checkEmailExists)
router.post('/users/check-username', requirePermission('system.users.manage'), authController.checkUsernameExists)
router.post('/users/check-employee-code', requirePermission('system.users.manage'), authController.checkEmployeeCodeExists)
router.post('/users/test-telegram', requirePermission('system.users.manage'), authController.testTelegram)

// Nhật ký gửi Telegram (tự dọn bản ghi > 3 ngày khi tải).
router.get('/telegram-logs', requirePermission('system.telegram_log.view'), listTelegramLogs)

// Sao lưu / Khôi phục.
// CSDL (nhỏ): tải .tgz về máy hoặc upload để khôi phục.
router.get('/admin/backup', requirePermission('system.backup.manage'), createBackup)
router.post('/admin/restore', requirePermission('system.backup.manage'), uploadRestore, restoreBackup)
// Tệp đính kèm uploads (rất lớn, hàng chục GB): gói tar trên đĩa VPS (job nền) rồi
// tải về máy bằng link stream (hỗ trợ nối lại); khôi phục từ tệp .tar có sẵn trên VPS.
router.post('/admin/uploads-backup', requirePermission('system.backup.manage'), buildUploadsBackup)
router.get('/admin/uploads-backup/status', requirePermission('system.backup.manage'), uploadsJobStatus)
router.get('/admin/uploads-backups', requirePermission('system.backup.manage'), listUploadsBackups)
router.get('/admin/uploads-backups/download', requirePermission('system.backup.manage'), downloadUploadsBackup)
router.delete('/admin/uploads-backups', requirePermission('system.backup.manage'), deleteUploadsBackup)
router.post('/admin/uploads-restore', requirePermission('system.backup.manage'), restoreUploads)

// Góp ý cải thiện phần mềm — mọi người dùng gửi (xem góp ý của mình), admin xem & xử lý tất cả.
router.get('/feedback', listFeedback)
router.post('/feedback', createFeedback)
router.post('/feedback/:id/images', uploadFeedbackImage.single('image'), addFeedbackImage)
router.put('/feedback/:id', requirePermission('system.feedback.manage'), updateFeedback)
router.delete('/feedback/:id', deleteFeedback)

// Department routes — danh mục dùng chung: ghi chỉ admin
router.get('/departments', authController.getAllDepartments)
router.post('/departments', requirePermission('system.departments.manage'), authController.createDepartment)
router.put('/departments/:id', requirePermission('system.departments.manage'), authController.updateDepartment)

// Position routes — danh mục dùng chung: ghi chỉ admin
router.get('/positions', authController.getAllPositions)
router.post('/positions', requirePermission('system.positions.manage'), authController.createPosition)
router.put('/positions/:id', requirePermission('system.positions.manage'), authController.updatePosition)

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

// Theo dõi độ phủ nhập hàng (đầu nhập) — phía HĐ bán
router.use('/', supplyCoverageRoutes)

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

// Quản lý Đấu thầu — Ban Kế hoạch Đấu thầu
router.use('/', tenderRoutes)

// Đề xuất / Phê duyệt (giống Base Request)
router.use('/', approvalRoutes)

// Xuất hóa đơn (HĐ bán)
router.use('/', invoiceRoutes)

// Báo cáo tài chính (kế toán / BGĐ / admin)
router.use('/', reportRoutes)

// Long-poll hợp nhất cho cảnh báo/badge (thay 3 vòng poll cũ)
router.use('/', liveRoutes)

// Module Phân quyền (RBAC) — chỉ system.permissions.manage (mặc định admin).
router.use('/', permissionRoutes)

// Nhật ký thay đổi (audit) — chỉ admin.
router.use('/', auditRoutes)

export default router
