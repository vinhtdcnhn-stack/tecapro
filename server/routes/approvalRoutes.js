import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import {
  getForms, getForm, createForm, updateForm, deleteForm, saveFields, saveSteps,
  saveFollowers, saveDepartments, getActiveForms, getFormSchema, getUserOptions, exportRequests,
} from '../controllers/approvalFormController.js'
import {
  getMyRequests, getInbox, getUpcoming, getFollowing, getAllRequests, getRequest, createRequest, updateRequest,
  submitRequest, cancelRequest, deleteRequest,
} from '../controllers/approvalRequestController.js'
import { approveRequest, rejectRequest } from '../controllers/approvalDecisionController.js'
import { adminDeleteRequest, adminRestoreRequest } from '../controllers/approvalAdminController.js'
import {
  upload, canUploadAttachment, getAttachments, uploadAttachment, deleteAttachment,
} from '../controllers/approvalAttachmentController.js'

// Module "Đề xuất / Phê duyệt". Mọi route đã nằm sau requireAuth (mount trong routes/index.js).
// Tiền tố /approvals. Cấu hình loại đơn (form builder) chỉ admin; tạo/duyệt đơn cho mọi nhân viên.
const router = Router()

// ── Tiện ích chung (mọi nhân viên) ──
router.get('/approvals/user-options', getUserOptions)

// ── Loại đơn cho người tạo đơn (mọi nhân viên) ──
router.get('/approvals/form-options', getActiveForms)
router.get('/approvals/forms/:id/schema', getFormSchema)

// ── Form builder (admin) ──
router.get('/approvals/forms', requireAdmin, getForms)
router.post('/approvals/forms', requireAdmin, createForm)
router.get('/approvals/forms/:id', requireAdmin, getForm)
router.get('/approvals/forms/:id/export', requireAdmin, exportRequests)
router.put('/approvals/forms/:id', requireAdmin, updateForm)
router.delete('/approvals/forms/:id', requireAdmin, deleteForm)
router.put('/approvals/forms/:id/fields', requireAdmin, saveFields)
router.put('/approvals/forms/:id/steps', requireAdmin, saveSteps)
router.put('/approvals/forms/:id/followers', requireAdmin, saveFollowers)
router.put('/approvals/forms/:id/departments', requireAdmin, saveDepartments)

// ── Đơn (mọi nhân viên) ──
router.get('/approvals/requests/my', getMyRequests)
router.get('/approvals/requests/inbox', getInbox)
router.get('/approvals/requests/upcoming', getUpcoming)
router.get('/approvals/requests/following', getFollowing)
router.get('/approvals/requests/all', requireAdmin, getAllRequests)
router.post('/approvals/requests', createRequest)
router.get('/approvals/requests/:id', getRequest)
router.put('/approvals/requests/:id', updateRequest)
router.delete('/approvals/requests/:id', deleteRequest)
router.post('/approvals/requests/:id/submit', submitRequest)
router.post('/approvals/requests/:id/cancel', cancelRequest)
router.post('/approvals/requests/:id/approve', approveRequest)
router.post('/approvals/requests/:id/reject', rejectRequest)

// ── Thao tác quản trị trên đơn (admin) ──
router.post('/approvals/requests/:id/admin-delete', requireAdmin, adminDeleteRequest)
router.post('/approvals/requests/:id/restore', requireAdmin, adminRestoreRequest)

// ── Đính kèm (guard ĐẶT TRƯỚC multer) ──
router.get('/approvals/requests/:requestId/attachments', getAttachments)
router.post('/approvals/requests/:requestId/attachments', canUploadAttachment, upload.single('file'), uploadAttachment)
router.delete('/approvals/request-attachments/:id', deleteAttachment)

export default router
